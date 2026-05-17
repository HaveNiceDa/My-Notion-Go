package documents

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrNotFound = errors.New("document not found")

// Repository 封装 documents 模块的数据库访问，Service 不直接拼 GORM 查询。
type Repository struct {
	db *gorm.DB
}

// NewRepository 注入共享的 GORM 连接。
// Repository 只负责“怎么查/怎么写数据库”，不判断标题是否合法、用户是否能访问等业务规则。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateWithContent 同时创建文档元信息和空正文。
// 这里必须用事务：如果 document 创建成功但 content 创建失败，事务会整体回滚，避免出现“有标题但没有正文”的脏数据。
func (r *Repository) CreateWithContent(ctx context.Context, document *Document) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Create 后，PostgreSQL 会生成 UUID 主键，GORM 会把生成的 id 回填到 document.ID。
		if err := tx.Create(document).Error; err != nil {
			return err
		}

		// path 依赖当前文档 ID，所以必须先 Create 拿到 ID，再回写 path。
		// 根文档 path = 自己的 ID；子文档 path = 父 path + "/" + 自己的 ID。
		path := document.ID
		if document.ParentID != nil {
			parent, err := r.findByID(ctx, tx, document.UserID, *document.ParentID)
			if err != nil {
				return err
			}
			path = joinPath(parent.Path, document.ID)
		}

		// 用 Model(&Document{}) + Where(...) 做局部更新，只更新 path 字段，不覆盖其它列。
		if err := tx.Model(&Document{}).
			Where("id = ? AND user_id = ?", document.ID, document.UserID).
			Update("path", path).
			Error; err != nil {
			return err
		}
		document.Path = path

		// 新建文档时就初始化正文记录。后续编辑器保存只需要 UPDATE document_contents。
		content := DocumentContent{
			DocumentID: document.ID,
			Content:    []byte("[]"),
		}
		return tx.Create(&content).Error
	})
}

// FindByID 查询当前用户拥有的、未软删除的文档。
// userID 是数据隔离的关键条件，避免用户通过猜 documentID 访问别人文档。
func (r *Repository) FindByID(ctx context.Context, userID string, documentID string) (Document, error) {
	return r.findByID(ctx, r.db.WithContext(ctx), userID, documentID)
}

// findByID 可以接收普通 db 或事务 tx。
// 这样 CreateWithContent 的事务内部也能复用同一套查询逻辑。
func (r *Repository) findByID(ctx context.Context, db *gorm.DB, userID string, documentID string) (Document, error) {
	var document Document
	err := db.WithContext(ctx).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", documentID, userID).
		First(&document).
		Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 把 GORM 的底层错误转换成模块自己的 ErrNotFound，让 Service/Handler 不依赖 GORM。
		return Document{}, ErrNotFound
	}

	return document, err
}

// ListActiveTree 查询侧边栏要展示的文档。
// 这里先查出扁平列表，再交给 Service 组装树；数据库负责过滤和排序，业务层负责结构转换。
func (r *Repository) ListActiveTree(ctx context.Context, userID string) ([]Document, error) {
	var documents []Document
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND is_archived = FALSE AND deleted_at IS NULL", userID).
		Order("parent_id NULLS FIRST").
		Order("position ASC").
		Order("created_at ASC").
		Find(&documents).
		Error
	return documents, err
}

// ListArchived 查询回收站列表。
// 当前设计中“回收站”对应 is_archived=true，不是 deleted_at；deleted_at 预留给软删除扩展。
func (r *Repository) ListArchived(ctx context.Context, userID string) ([]Document, error) {
	var documents []Document
	err := r.db.WithContext(ctx).
		Where("user_id = ? AND is_archived = TRUE AND deleted_at IS NULL", userID).
		Order("updated_at DESC").
		Find(&documents).
		Error
	return documents, err
}

// SearchDocuments 提供 M6.0 的最小搜索实现：标题优先，正文 JSONB 文本弱匹配兜底。
// 查询必须带 user_id，避免未来替换为 ES 前先在 PostgreSQL 路径里破坏数据隔离约束。
func (r *Repository) SearchDocuments(ctx context.Context, userID string, query string, includeArchived bool, limit int) ([]Document, error) {
	var documents []Document
	likeQuery := "%" + escapePostgresLike(query) + "%"
	db := r.db.WithContext(ctx).
		Model(&Document{}).
		Select("documents.*").
		Joins("LEFT JOIN document_contents ON document_contents.document_id = documents.id").
		Where("documents.user_id = ? AND documents.deleted_at IS NULL", userID).
		Where("(documents.title ILIKE ? ESCAPE '\\' OR document_contents.content::text ILIKE ? ESCAPE '\\')", likeQuery, likeQuery)
	if !includeArchived {
		db = db.Where("documents.is_archived = FALSE")
	}

	err := db.
		Order(clause.Expr{
			SQL:  "CASE WHEN documents.title ILIKE ? ESCAPE '\\' THEN 0 ELSE 1 END",
			Vars: []any{likeQuery},
		}).
		Order("documents.updated_at DESC").
		Limit(limit).
		Find(&documents).
		Error
	return documents, err
}

// NextPosition 计算同一父节点下新文档的排序值。
// 第一版用 max(position)+1，足够支撑“追加到末尾”；后续做拖拽排序时再引入更精细的 position 生成策略。
func (r *Repository) NextPosition(ctx context.Context, userID string, parentID *string) (float64, error) {
	return r.nextPosition(ctx, r.db.WithContext(ctx), userID, parentID)
}

func (r *Repository) NextStarredPosition(ctx context.Context, userID string) (float64, error) {
	var maxPosition sql.NullFloat64
	if err := r.db.WithContext(ctx).
		Model(&Document{}).
		Where("user_id = ? AND is_starred = TRUE AND is_archived = FALSE AND deleted_at IS NULL", userID).
		Select("MAX(starred_position)").
		Scan(&maxPosition).
		Error; err != nil {
		return 0, err
	}
	if !maxPosition.Valid {
		return 1, nil
	}

	return maxPosition.Float64 + 1, nil
}

func (r *Repository) nextPosition(ctx context.Context, db *gorm.DB, userID string, parentID *string) (float64, error) {
	var maxPosition sql.NullFloat64
	query := db.WithContext(ctx).
		Model(&Document{}).
		Where("user_id = ? AND deleted_at IS NULL", userID)
	if parentID == nil {
		query = query.Where("parent_id IS NULL")
	} else {
		query = query.Where("parent_id = ?", *parentID)
	}

	// MAX(position) 在没有兄弟节点时会返回 SQL NULL，所以用 sql.NullFloat64 区分“没有值”和“值为 0”。
	if err := query.Select("MAX(position)").Scan(&maxPosition).Error; err != nil {
		return 0, err
	}
	if !maxPosition.Valid {
		return 1, nil
	}

	return maxPosition.Float64 + 1, nil
}

// UpdateMetadata 做文档元信息的局部更新。
// updates 由 Service 白名单构造，Repository 不接受前端原始 map，避免误更新 user_id、path 等敏感字段。
func (r *Repository) UpdateMetadata(ctx context.Context, userID string, documentID string, updates map[string]any) (Document, error) {
	result := r.db.WithContext(ctx).
		Model(&Document{}).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", documentID, userID).
		Updates(updates)
	if result.Error != nil {
		return Document{}, result.Error
	}
	if result.RowsAffected == 0 {
		return Document{}, ErrNotFound
	}

	return r.FindByID(ctx, userID, documentID)
}

func (r *Repository) UpdateStarredPositions(ctx context.Context, userID string, orderedIDs []string) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for index, documentID := range orderedIDs {
			result := tx.Model(&Document{}).
				Where("id = ? AND user_id = ? AND is_starred = TRUE AND is_archived = FALSE AND deleted_at IS NULL", documentID, userID).
				Update("starred_position", float64(index+1))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return ErrInvalidInput
			}
		}
		return nil
	})
}

// Move 把文档移动到新的父文档下，并同步更新整棵子树的 path。
// parentID=nil 表示移动到根层级；updates 用于和标题/图标等元信息更新合并成一次 PATCH。
func (r *Repository) Move(ctx context.Context, userID string, documentID string, parentID *string, updates map[string]any) (Document, error) {
	var moved Document
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		document, err := r.findByID(ctx, tx, userID, documentID)
		if err != nil {
			return err
		}

		newPath := document.ID
		if parentID != nil {
			parent, err := r.findByID(ctx, tx, userID, *parentID)
			if err != nil {
				return err
			}
			// 不能把文档移动到自己的后代里，否则会形成循环树。
			if parent.ID == document.ID || strings.HasPrefix(parent.Path+"/", document.Path+"/") {
				return ErrInvalidInput
			}
			newPath = joinPath(parent.Path, document.ID)
		}

		position, err := r.nextPosition(ctx, tx, userID, parentID)
		if err != nil {
			return err
		}

		oldPath := document.Path
		var parentValue any
		if parentID != nil {
			parentValue = *parentID
		}
		moveUpdates := map[string]any{
			"parent_id": parentValue,
			"position":  position,
			"path":      newPath,
		}
		for key, value := range updates {
			moveUpdates[key] = value
		}

		if err := tx.Model(&Document{}).
			Where("id = ? AND user_id = ? AND deleted_at IS NULL", document.ID, userID).
			Updates(moveUpdates).
			Error; err != nil {
			return err
		}

		var descendants []Document
		if err := tx.
			Where("user_id = ? AND deleted_at IS NULL AND path LIKE ?", userID, oldPath+"/%").
			Find(&descendants).
			Error; err != nil {
			return err
		}

		for _, descendant := range descendants {
			descendantPath := newPath + strings.TrimPrefix(descendant.Path, oldPath)
			if err := tx.Model(&Document{}).
				Where("id = ? AND user_id = ?", descendant.ID, userID).
				Update("path", descendantPath).
				Error; err != nil {
				return err
			}
		}

		moved, err = r.findByID(ctx, tx, userID, documentID)
		return err
	})
	return moved, err
}

// SetArchivedByPath 归档或恢复一整棵文档子树。
// 条件里的 id = root.ID 命中根节点，path LIKE root.Path + "/%" 命中所有后代节点。
func (r *Repository) SetArchivedByPath(ctx context.Context, userID string, root Document, archived bool) error {
	result := r.db.WithContext(ctx).
		Model(&Document{}).
		Where("user_id = ? AND deleted_at IS NULL AND (id = ? OR path LIKE ?)", userID, root.ID, root.Path+"/%").
		Update("is_archived", archived)
	return result.Error
}

// HardDeleteByPath 永久删除一整棵文档子树。
// document_contents 有 ON DELETE CASCADE，所以删除 documents 后，正文记录会被数据库自动删除。
func (r *Repository) HardDeleteByPath(ctx context.Context, userID string, root Document) error {
	return r.db.WithContext(ctx).
		Where("user_id = ? AND deleted_at IS NULL AND (id = ? OR path LIKE ?)", userID, root.ID, root.Path+"/%").
		Delete(&Document{}).
		Error
}

// SoftDeleteByID 预留给后续“软删除”语义。
// 当前 API 的 DELETE 是永久删除，所以这次暂时没有接入该方法。
func (r *Repository) SoftDeleteByID(ctx context.Context, userID string, documentID string, deletedAt time.Time) error {
	result := r.db.WithContext(ctx).
		Model(&Document{}).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", documentID, userID).
		Update("deleted_at", deletedAt)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

// joinPath 负责把父 path 和当前文档 id 拼成标准路径。
// 统一在这里处理首尾斜杠，可以避免不同调用点拼出不一致的 path。
func joinPath(parentPath string, id string) string {
	parentPath = strings.Trim(parentPath, "/")
	if parentPath == "" {
		return id
	}

	return parentPath + "/" + id
}

func escapePostgresLike(value string) string {
	value = strings.ReplaceAll(value, `\`, `\\`)
	value = strings.ReplaceAll(value, `%`, `\%`)
	value = strings.ReplaceAll(value, `_`, `\_`)
	return value
}
