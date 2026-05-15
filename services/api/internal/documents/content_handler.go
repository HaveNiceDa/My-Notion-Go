package documents

import (
	"encoding/json"
	"net/http"

	"github.com/bytel/my-notion-go/services/api/internal/response"
	"github.com/gin-gonic/gin"
)

// updateContentRequest 保留 content 的原始 JSON。
// 用 json.RawMessage 可以避免先反序列化成 map/slice 再序列化，减少编辑器 JSON 的结构损耗。
type updateContentRequest struct {
	Content json.RawMessage `json:"content" binding:"required"`
}

// GetContent 处理 GET /api/v1/documents/:id/content。
// 它只返回正文 JSON，不返回文档标题等 metadata，避免编辑器页面重复加载大对象。
func (h *Handler) GetContent(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id, ok := bindDocumentID(c)
	if !ok {
		return
	}

	content, err := h.service.GetDocumentContent(c.Request.Context(), userID, id)
	if err != nil {
		writeDocumentError(c, err)
		return
	}

	response.OK(c, content)
}

// UpdateContent 处理 PUT /api/v1/documents/:id/content。
// 保存语义是“覆盖当前正文”，前端自动保存每次提交完整 BlockNote document。
func (h *Handler) UpdateContent(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}

	id, ok := bindDocumentID(c)
	if !ok {
		return
	}

	var req updateContentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid update content request.")
		return
	}

	content, err := h.service.UpdateDocumentContent(c.Request.Context(), UpdateDocumentContentInput{
		UserID:     userID,
		DocumentID: id,
		Content:    req.Content,
	})
	if err != nil {
		writeDocumentError(c, err)
		return
	}

	response.OK(c, content)
}
