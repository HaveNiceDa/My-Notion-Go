package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/bytel/my-notion-go/services/api/internal/auth"
	"github.com/bytel/my-notion-go/services/api/internal/response"
	"github.com/gin-gonic/gin"
)

// RequireAuth 是保护接口用的 Gin 中间件。
// 它要求请求带 Authorization: Bearer <accessToken>，校验通过后把 userID 放进 Gin context。
func RequireAuth(tokenManager *auth.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		const bearerPrefix = "Bearer "
		if !strings.HasPrefix(authHeader, bearerPrefix) {
			response.Error(c, http.StatusUnauthorized, "UNAUTHORIZED", "Missing bearer token.")
			c.Abort()
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(authHeader, bearerPrefix))
		userID, err := tokenManager.ParseAccessToken(token, time.Now())
		if err != nil {
			response.Error(c, http.StatusUnauthorized, "INVALID_TOKEN", "Invalid or expired token.")
			c.Abort()
			return
		}

		auth.SetUserID(c, userID)
		c.Next()
	}
}
