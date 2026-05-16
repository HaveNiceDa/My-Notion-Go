package rag

import (
	"errors"
	"net/http"

	"github.com/bytel/my-notion-go/services/api/internal/auth"
	"github.com/bytel/my-notion-go/services/api/internal/response"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *Service
}

type documentIDURI struct {
	ID string `uri:"id" binding:"required"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func (h *Handler) EnableDocumentIndex(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	documentID, ok := bindDocumentID(c)
	if !ok {
		return
	}

	status, err := h.service.EnableDocumentIndex(c.Request.Context(), userID, documentID)
	if err != nil {
		writeRAGError(c, err)
		return
	}

	response.OK(c, status)
}

func (h *Handler) DisableDocumentIndex(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	documentID, ok := bindDocumentID(c)
	if !ok {
		return
	}

	status, err := h.service.DisableDocumentIndex(c.Request.Context(), userID, documentID)
	if err != nil {
		writeRAGError(c, err)
		return
	}

	response.OK(c, status)
}

func (h *Handler) GetDocumentStatus(c *gin.Context) {
	userID, ok := currentUserID(c)
	if !ok {
		return
	}
	documentID, ok := bindDocumentID(c)
	if !ok {
		return
	}

	status, err := h.service.GetDocumentStatus(c.Request.Context(), userID, documentID)
	if err != nil {
		writeRAGError(c, err)
		return
	}

	response.OK(c, status)
}

func currentUserID(c *gin.Context) (string, bool) {
	userID, ok := auth.UserIDFromContext(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authenticated user.")
		return "", false
	}
	return userID, true
}

func bindDocumentID(c *gin.Context) (string, bool) {
	var uri documentIDURI
	if err := c.ShouldBindUri(&uri); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid document id.")
		return "", false
	}
	return uri.ID, true
}

func writeRAGError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrInvalidInput):
		response.Error(c, http.StatusBadRequest, "INVALID_INPUT", "Invalid RAG input.")
	case errors.Is(err, ErrDocumentNotFound):
		response.Error(c, http.StatusNotFound, "DOCUMENT_NOT_FOUND", "Document not found.")
	default:
		response.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error.")
	}
}
