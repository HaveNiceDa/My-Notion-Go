package documents

import (
	"errors"
	"net/http"

	"github.com/bytel/my-notion-go/services/api/internal/auth"
	"github.com/bytel/my-notion-go/services/api/internal/response"
	"github.com/gin-gonic/gin"
)

// Handler 负责 Document 模块的 HTTP 入参解析、鉴权上下文读取和响应写入。
type Handler struct {
	service *Service
}

// documentIDURI 对应路由里的 :id，例如 /api/v1/documents/:id。
// Gin 的 ShouldBindUri 会根据 `uri:"id"` 把路径参数填到 ID 字段。
type documentIDURI struct {
	ID string `uri:"id" binding:"required"`
}

// createDocumentRequest 是 HTTP JSON 请求体。
// 它和 Service 的 CreateDocumentInput 分开定义，是为了让 HTTP 层和业务层解耦。
type createDocumentRequest struct {
	ParentID   *string `json:"parentId"`
	Title      string  `json:"title"`
	Icon       string  `json:"icon"`
	CoverImage string  `json:"coverImage"`
}

// updateDocumentRequest 的字段都是指针，用来区分“没传”和“传了零值”。
// 例如 isStarred=false 是有效更新，不能因为 false 是 bool 零值就忽略。
type updateDocumentRequest struct {
	Title      *string `json:"title"`
	Icon       *string `json:"icon"`
	CoverImage *string `json:"coverImage"`
	IsStarred  *bool   `json:"isStarred"`
	ParentID   *string `json:"parentId"`
}

// NewHandler 注入 Service。
// Handler 只处理 HTTP 细节：绑定参数、读取登录用户、把业务结果写成统一响应。
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Create 处理 POST /api/v1/documents。
// 请求必须已经经过 RequireAuth 中间件，因此这里可以从 Gin context 读取 userID。
func (h *Handler) Create(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	var req createDocumentRequest
	// ShouldBindJSON 会根据 binding tag 和 JSON 类型做基础校验；更细的业务校验放在 Service。
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid create document request.")
		return
	}

	document, err := h.service.CreateDocument(c.Request.Context(), CreateDocumentInput{
		UserID:     userID,
		ParentID:   req.ParentID,
		Title:      req.Title,
		Icon:       req.Icon,
		CoverImage: req.CoverImage,
	})
	if err != nil {
		writeDocumentError(c, err)
		return
	}

	response.Created(c, document)
}

// Tree 处理 GET /api/v1/documents/tree，返回侧边栏要用的递归文档树。
func (h *Handler) Tree(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	tree, err := h.service.GetTree(c.Request.Context(), userID)
	if err != nil {
		writeDocumentError(c, err)
		return
	}

	response.OK(c, tree)
}

// Trash 处理 GET /api/v1/documents/trash，返回当前用户已归档文档。
func (h *Handler) Trash(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	documents, err := h.service.GetTrash(c.Request.Context(), userID)
	if err != nil {
		writeDocumentError(c, err)
		return
	}

	response.OK(c, documents)
}

// Get 处理 GET /api/v1/documents/:id。
// 当前只返回 metadata，正文读取后续会放到 content/editor 接口。
func (h *Handler) Get(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id, ok := bindDocumentID(c)
	if !ok {
		return
	}

	document, err := h.service.GetDocument(c.Request.Context(), userID, id)
	if err != nil {
		writeDocumentError(c, err)
		return
	}

	response.OK(c, document)
}

// Update 处理 PATCH /api/v1/documents/:id。
// PATCH 语义是局部更新，因此请求体字段使用指针来表示是否更新。
func (h *Handler) Update(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id, ok := bindDocumentID(c)
	if !ok {
		return
	}

	var req updateDocumentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid update document request.")
		return
	}

	document, err := h.service.UpdateDocument(c.Request.Context(), UpdateDocumentInput{
		UserID:     userID,
		DocumentID: id,
		Title:      req.Title,
		Icon:       req.Icon,
		CoverImage: req.CoverImage,
		IsStarred:  req.IsStarred,
		ParentID:   req.ParentID,
	})
	if err != nil {
		writeDocumentError(c, err)
		return
	}

	response.OK(c, document)
}

// Archive 处理 POST /api/v1/documents/:id/archive。
// 归档逻辑会作用到整棵子树，不只是当前节点。
func (h *Handler) Archive(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id, ok := bindDocumentID(c)
	if !ok {
		return
	}

	if err := h.service.ArchiveDocument(c.Request.Context(), userID, id); err != nil {
		writeDocumentError(c, err)
		return
	}

	response.OK(c, gin.H{"message": "Document archived."})
}

// Restore 处理 POST /api/v1/documents/:id/restore。
// 恢复逻辑和归档一样，按 path 作用到整棵子树。
func (h *Handler) Restore(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id, ok := bindDocumentID(c)
	if !ok {
		return
	}

	if err := h.service.RestoreDocument(c.Request.Context(), userID, id); err != nil {
		writeDocumentError(c, err)
		return
	}

	response.OK(c, gin.H{"message": "Document restored."})
}

// Delete 处理 DELETE /api/v1/documents/:id。
// 当前实现是永久删除，数据库会通过外键级联删除对应 document_contents。
func (h *Handler) Delete(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id, ok := bindDocumentID(c)
	if !ok {
		return
	}

	if err := h.service.DeleteDocument(c.Request.Context(), userID, id); err != nil {
		writeDocumentError(c, err)
		return
	}

	response.OK(c, gin.H{"message": "Document deleted."})
}

// currentUserID 从鉴权中间件写入的 Gin context 里读取 userID。
// 如果未来换鉴权方案，只需要保持 auth.UserIDFromContext 的契约即可。
func currentUserID(c *gin.Context) (string, bool) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authenticated user.")
		return "", false
	}

	return userID, true
}

// bindDocumentID 统一读取路径里的 :id。
// 这样每个 Handler 不需要重复写 ShouldBindUri 和错误响应。
func bindDocumentID(c *gin.Context) (string, bool) {
	var uri documentIDURI
	if err := c.ShouldBindUri(&uri); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid document id.")
		return "", false
	}

	return uri.ID, true
}

// writeDocumentError 把 Service/Repository 返回的业务错误映射成稳定的 HTTP 响应。
// Handler 统一在这里做错误翻译，前端就可以根据 error.code 做分支处理。
func writeDocumentError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrInvalidInput):
		response.Error(c, http.StatusBadRequest, "INVALID_INPUT", "Invalid document input.")
	case errors.Is(err, ErrNotFound):
		response.Error(c, http.StatusNotFound, "DOCUMENT_NOT_FOUND", "Document not found.")
	default:
		response.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error.")
	}
}
