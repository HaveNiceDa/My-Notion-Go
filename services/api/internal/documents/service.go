package documents

import (
	"context"
	"errors"
	"regexp"
	"strings"
)

var (
	ErrInvalidInput = errors.New("invalid document input")
	ErrForbidden    = errors.New("document operation is forbidden")
)

const defaultDocumentTitle = "Untitled"
const (
	defaultSearchLimit = 20
	maxSearchLimit     = 50
)

// uuidPattern 只做格式层面的快速校验。
// 真正的“是否存在、是否属于当前用户”仍然要去数据库按 user_id 查询。
var uuidPattern = regexp.MustCompile(`(?i)^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// Service 承载 Document 业务规则：归属校验、标题规范化、树结构组装和文档状态变更。
type Service struct {
	repo               *Repository
	contentUpdatedHook ContentUpdatedHook
}

type ContentUpdatedHook func(ctx context.Context, userID string, documentID string) error

// CreateDocumentInput 是创建文档用例的内部入参。
// Handler 负责从 HTTP JSON 解析请求，Service 使用这个结构表达业务所需字段，避免直接依赖 Gin。
type CreateDocumentInput struct {
	UserID     string
	ParentID   *string
	Title      string
	Icon       string
	CoverImage string
}

// UpdateDocumentInput 使用指针字段表达“是否传了这个字段”。
// 例如 title=nil 表示不更新标题，title=&"" 表示用户传了空标题，需要按业务规则拒绝。
type UpdateDocumentInput struct {
	UserID     string
	DocumentID string
	Title      *string
	Icon       *string
	CoverImage *string
	IsStarred  *bool
	ParentID   *string
}

type SearchDocumentsInput struct {
	UserID          string
	Query           string
	IncludeArchived bool
	Limit           int
}

// NewService 注入 Repository。
// 这样 Service 可以专注业务规则，具体数据库实现仍然被 Repository 隔离。
func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) SetContentUpdatedHook(hook ContentUpdatedHook) {
	s.contentUpdatedHook = hook
}

// CreateDocument 创建一个属于当前用户的文档。
// 核心流程：校验用户和父文档 -> 计算同级排序位置 -> 创建文档和空正文 -> 返回 DTO。
func (s *Service) CreateDocument(ctx context.Context, input CreateDocumentInput) (DocumentDTO, error) {
	userID := strings.TrimSpace(input.UserID)
	if userID == "" {
		return DocumentDTO{}, ErrInvalidInput
	}

	parentID := normalizeOptionalID(input.ParentID)
	if parentID != nil {
		if !isValidUUID(*parentID) {
			return DocumentDTO{}, ErrInvalidInput
		}
		// 父文档必须属于当前用户。这里不需要额外比较 user_id，因为 Repository 查询已经带了 userID 条件。
		if _, err := s.repo.FindByID(ctx, userID, *parentID); err != nil {
			return DocumentDTO{}, err
		}
	}

	// position 第一版只保证同级追加顺序。未来拖拽排序可以改成在两个 position 中间取值。
	position, err := s.repo.NextPosition(ctx, userID, parentID)
	if err != nil {
		return DocumentDTO{}, err
	}

	document := Document{
		UserID:     userID,
		ParentID:   parentID,
		Title:      normalizeTitle(input.Title),
		Icon:       strings.TrimSpace(input.Icon),
		CoverImage: strings.TrimSpace(input.CoverImage),
		// M5 起产品规则改为“文档默认进入知识库”，后续用户可通过 RAG API 显式关闭。
		IsInKnowledgeBase: true,
		Position:          position,
	}
	if err := s.repo.CreateWithContent(ctx, &document); err != nil {
		return DocumentDTO{}, err
	}

	return NewDocumentDTO(document), nil
}

// GetDocument 获取单个文档的元信息。
// 注意这里返回的是文档 metadata，正文内容会在后续 content/editor 接口里单独读取。
func (s *Service) GetDocument(ctx context.Context, userID string, documentID string) (DocumentDTO, error) {
	userID = strings.TrimSpace(userID)
	documentID = strings.TrimSpace(documentID)
	if userID == "" || !isValidUUID(documentID) {
		return DocumentDTO{}, ErrInvalidInput
	}

	document, err := s.repo.FindByID(ctx, userID, documentID)
	if err != nil {
		return DocumentDTO{}, err
	}

	return NewDocumentDTO(document), nil
}

// GetTree 返回当前用户未归档的文档树。
// Repository 返回扁平列表，Service 在内存中组树，适合 MVP 阶段的数据规模和实现复杂度。
func (s *Service) GetTree(ctx context.Context, userID string) ([]DocumentTreeDTO, error) {
	documents, err := s.repo.ListActiveTree(ctx, strings.TrimSpace(userID))
	if err != nil {
		return nil, err
	}

	return buildTree(documents), nil
}

// GetTrash 返回已归档文档列表。
// 这里暂时返回扁平列表，便于前端做回收站；恢复时仍然会按 path 恢复整棵子树。
func (s *Service) GetTrash(ctx context.Context, userID string) ([]DocumentDTO, error) {
	documents, err := s.repo.ListArchived(ctx, strings.TrimSpace(userID))
	if err != nil {
		return nil, err
	}

	return mapDocuments(documents), nil
}

// SearchDocuments 是 M6.0 的搜索入口。当前使用 PostgreSQL，后续接 ES 时保持 DTO 不变即可替换底层实现。
func (s *Service) SearchDocuments(ctx context.Context, input SearchDocumentsInput) ([]DocumentSearchResultDTO, error) {
	userID := strings.TrimSpace(input.UserID)
	query := normalizeSearchQuery(input.Query)
	if userID == "" || query == "" {
		return nil, ErrInvalidInput
	}

	limit := input.Limit
	if limit <= 0 {
		limit = defaultSearchLimit
	}
	if limit > maxSearchLimit {
		limit = maxSearchLimit
	}

	documents, err := s.repo.SearchDocuments(ctx, userID, query, input.IncludeArchived, limit)
	if err != nil {
		return nil, err
	}

	return mapSearchResults(documents, query), nil
}

// UpdateDocument 只允许更新白名单字段。
// 不能让前端直接提交任意 map，否则可能修改 user_id、path、deleted_at 等敏感字段。
func (s *Service) UpdateDocument(ctx context.Context, input UpdateDocumentInput) (DocumentDTO, error) {
	input.UserID = strings.TrimSpace(input.UserID)
	input.DocumentID = strings.TrimSpace(input.DocumentID)
	if input.UserID == "" || !isValidUUID(input.DocumentID) {
		return DocumentDTO{}, ErrInvalidInput
	}

	updates := map[string]any{}
	if input.Title != nil {
		title := strings.TrimSpace(*input.Title)
		if title == "" {
			return DocumentDTO{}, ErrInvalidInput
		}
		updates["title"] = title
	}
	if input.Icon != nil {
		updates["icon"] = strings.TrimSpace(*input.Icon)
	}
	if input.CoverImage != nil {
		updates["cover_image"] = strings.TrimSpace(*input.CoverImage)
	}
	if input.IsStarred != nil {
		updates["is_starred"] = *input.IsStarred
	}
	if input.ParentID != nil {
		parentID := normalizeOptionalID(input.ParentID)
		if parentID != nil {
			if !isValidUUID(*parentID) || *parentID == input.DocumentID {
				return DocumentDTO{}, ErrInvalidInput
			}
		}

		document, err := s.repo.Move(ctx, input.UserID, input.DocumentID, parentID, updates)
		if err != nil {
			return DocumentDTO{}, err
		}

		return NewDocumentDTO(document), nil
	}
	if len(updates) == 0 {
		// PATCH 空对象时不报错，直接返回当前文档，方便前端复用同一个更新接口。
		return s.GetDocument(ctx, input.UserID, input.DocumentID)
	}

	document, err := s.repo.UpdateMetadata(ctx, input.UserID, input.DocumentID, updates)
	if err != nil {
		return DocumentDTO{}, err
	}

	return NewDocumentDTO(document), nil
}

// ArchiveDocument 把根文档和所有后代文档移动到回收站。
// 子树范围由 root.Path 决定，因此先查询 root，确保它存在且属于当前用户。
func (s *Service) ArchiveDocument(ctx context.Context, userID string, documentID string) error {
	userID = strings.TrimSpace(userID)
	documentID = strings.TrimSpace(documentID)
	if userID == "" || !isValidUUID(documentID) {
		return ErrInvalidInput
	}

	root, err := s.repo.FindByID(ctx, userID, documentID)
	if err != nil {
		return err
	}

	return s.repo.SetArchivedByPath(ctx, userID, root, true)
}

// RestoreDocument 从回收站恢复根文档和所有后代文档。
// 第一版不额外校验父文档是否仍在回收站外；后续如果支持复杂移动/删除，可以补更细规则。
func (s *Service) RestoreDocument(ctx context.Context, userID string, documentID string) error {
	userID = strings.TrimSpace(userID)
	documentID = strings.TrimSpace(documentID)
	if userID == "" || !isValidUUID(documentID) {
		return ErrInvalidInput
	}

	root, err := s.repo.FindByID(ctx, userID, documentID)
	if err != nil {
		return err
	}

	return s.repo.SetArchivedByPath(ctx, userID, root, false)
}

// DeleteDocument 永久删除根文档和所有后代文档。
// 这是不可恢复操作；如果未来希望支持“先归档再清空回收站”，可以把入口限制到已归档文档。
func (s *Service) DeleteDocument(ctx context.Context, userID string, documentID string) error {
	userID = strings.TrimSpace(userID)
	documentID = strings.TrimSpace(documentID)
	if userID == "" || !isValidUUID(documentID) {
		return ErrInvalidInput
	}

	root, err := s.repo.FindByID(ctx, userID, documentID)
	if err != nil {
		return err
	}

	return s.repo.HardDeleteByPath(ctx, userID, root)
}

// normalizeOptionalID 把空字符串 parentId 视为 nil。
// Go 里 nil 指针很适合表达“没有父文档”，也能自然对应数据库里的 parent_id NULL。
func normalizeOptionalID(id *string) *string {
	if id == nil {
		return nil
	}

	value := strings.TrimSpace(*id)
	if value == "" {
		return nil
	}

	return &value
}

// normalizeTitle 统一处理标题默认值。
// 这样 Handler 不需要知道默认标题是什么，前端不传 title 时也能创建文档。
func normalizeTitle(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return defaultDocumentTitle
	}

	return title
}

func normalizeSearchQuery(query string) string {
	return strings.Join(strings.Fields(query), " ")
}

// isValidUUID 避免明显无效的 id 进入 PostgreSQL UUID 查询。
// 如果直接把 "abc" 传给 uuid 字段查询，数据库会报类型转换错误，最终变成 500。
func isValidUUID(id string) bool {
	return uuidPattern.MatchString(strings.TrimSpace(id))
}

// mapDocuments 批量把数据库模型转成 DTO。
// 预分配 slice 容量可以减少 append 时的内存扩容。
func mapDocuments(documents []Document) []DocumentDTO {
	result := make([]DocumentDTO, 0, len(documents))
	for _, document := range documents {
		result = append(result, NewDocumentDTO(document))
	}

	return result
}

func mapSearchResults(documents []Document, query string) []DocumentSearchResultDTO {
	result := make([]DocumentSearchResultDTO, 0, len(documents))
	normalizedQuery := strings.ToLower(strings.TrimSpace(query))
	for _, document := range documents {
		matchType := "content"
		preview := document.Title
		if strings.Contains(strings.ToLower(document.Title), normalizedQuery) {
			matchType = "title"
		}
		result = append(result, DocumentSearchResultDTO{
			Document:  NewDocumentDTO(document),
			MatchType: matchType,
			Preview:   preview,
		})
	}

	return result
}

// buildTree 把数据库查出的扁平文档列表组装成递归树。
// 算法分两步：先按 id 建 map，保证 O(1) 找父节点；再遍历一次把节点挂到父节点 children。
func buildTree(documents []Document) []DocumentTreeDTO {
	nodes := make(map[string]*DocumentTreeDTO, len(documents))
	childrenByParent := make(map[string][]string, len(documents))
	rootIDs := make([]string, 0)

	for _, document := range documents {
		dto := NewDocumentDTO(document)
		nodes[document.ID] = &DocumentTreeDTO{
			DocumentDTO: dto,
			Children:    []DocumentTreeDTO{},
		}
	}

	for _, document := range documents {
		if document.ParentID == nil {
			rootIDs = append(rootIDs, document.ID)
			continue
		}

		if _, ok := nodes[*document.ParentID]; !ok {
			// 父文档不在当前结果中时，将它作为根节点返回，避免侧边栏完全丢失孤儿节点。
			rootIDs = append(rootIDs, document.ID)
			continue
		}
		childrenByParent[*document.ParentID] = append(childrenByParent[*document.ParentID], document.ID)
	}

	roots := make([]DocumentTreeDTO, 0, len(rootIDs))
	for _, rootID := range rootIDs {
		roots = append(roots, buildTreeNode(rootID, nodes, childrenByParent))
	}

	return roots
}

// buildTreeNode 按父子 id 索引递归生成树，避免提前 append 值拷贝导致孙级节点丢失。
func buildTreeNode(id string, nodes map[string]*DocumentTreeDTO, childrenByParent map[string][]string) DocumentTreeDTO {
	node := nodes[id]
	if node == nil {
		return DocumentTreeDTO{}
	}

	result := DocumentTreeDTO{
		DocumentDTO: node.DocumentDTO,
		Children:    make([]DocumentTreeDTO, 0, len(childrenByParent[id])),
	}
	for _, childID := range childrenByParent[id] {
		result.Children = append(result.Children, buildTreeNode(childID, nodes, childrenByParent))
	}

	return result
}
