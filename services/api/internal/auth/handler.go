package auth

import (
	"errors"
	"net/http"
	"strings"

	"github.com/bytel/my-notion-go/services/api/internal/response"
	"github.com/gin-gonic/gin"
)

// Handler 负责把 HTTP 请求转换成 Service 入参，并把业务错误映射成 HTTP 状态码。
type Handler struct {
	service *Service
}

type registerRequest struct {
	Email    string `json:"email" binding:"required"`
	Name     string `json:"name"`
	Password string `json:"password" binding:"required"`
}

type loginRequest struct {
	Email      string `json:"email" binding:"required"`
	Password   string `json:"password" binding:"required"`
	DeviceName string `json:"deviceName"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

type logoutRequest struct {
	RefreshToken string `json:"refreshToken" binding:"required"`
}

func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Register 处理用户注册。成功后会直接返回用户信息和 token，前端可以自动进入登录态。
func (h *Handler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid register request.")
		return
	}

	result, err := h.service.Register(c.Request.Context(), RegisterInput{
		Email:    req.Email,
		Name:     req.Name,
		Password: req.Password,
	})
	if err != nil {
		writeAuthError(c, err)
		return
	}

	response.Created(c, result)
}

// Login 处理邮箱密码登录，并记录设备名、IP、User-Agent 到 refresh_tokens 表。
func (h *Handler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid login request.")
		return
	}

	result, err := h.service.Login(c.Request.Context(), LoginInput{
		Email:      req.Email,
		Password:   req.Password,
		DeviceName: req.DeviceName,
		IPAddress:  c.ClientIP(),
		UserAgent:  c.GetHeader("User-Agent"),
	})
	if err != nil {
		writeAuthError(c, err)
		return
	}

	response.OK(c, result)
}

// Refresh 使用 refresh token 续期登录态。
func (h *Handler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid refresh request.")
		return
	}

	result, err := h.service.Refresh(c.Request.Context(), strings.TrimSpace(req.RefreshToken))
	if err != nil {
		writeAuthError(c, err)
		return
	}

	response.OK(c, result)
}

// Logout 撤销 refresh token，当前 Access Token 会在自然过期后失效。
func (h *Handler) Logout(c *gin.Context) {
	var req logoutRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Error(c, http.StatusBadRequest, "BAD_REQUEST", "Invalid logout request.")
		return
	}

	if err := h.service.Logout(c.Request.Context(), strings.TrimSpace(req.RefreshToken)); err != nil {
		writeAuthError(c, err)
		return
	}

	response.OK(c, gin.H{"message": "Logged out."})
}

// Me 返回当前登录用户。userID 来自 RequireAuth 中间件解析出的 Access Token。
func (h *Handler) Me(c *gin.Context) {
	userID, ok := UserIDFromContext(c)
	if !ok {
		response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing authenticated user.")
		return
	}

	user, err := h.service.GetUser(c.Request.Context(), userID)
	if err != nil {
		writeAuthError(c, err)
		return
	}

	response.OK(c, user)
}

func writeAuthError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrInvalidInput):
		response.Error(c, http.StatusBadRequest, "INVALID_INPUT", "Email must be valid and password must be at least 8 characters.")
	case errors.Is(err, ErrEmailAlreadyExists):
		response.Error(c, http.StatusConflict, "EMAIL_ALREADY_EXISTS", "Email already exists.")
	case errors.Is(err, ErrInvalidCredential):
		response.Error(c, http.StatusUnauthorized, "INVALID_CREDENTIAL", "Invalid email or password.")
	case errors.Is(err, ErrInvalidToken):
		response.Error(c, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid or expired token.")
	default:
		response.Error(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Internal server error.")
	}
}
