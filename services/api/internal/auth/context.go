package auth

import "github.com/gin-gonic/gin"

// userIDContextKey 是 Gin context 中保存当前登录用户 ID 的 key。
// 使用常量可以避免不同文件里手写字符串导致拼写不一致。
const userIDContextKey = "userID"

// SetUserID 由鉴权中间件调用，把 Access Token 解析出的用户 ID 写入请求上下文。
func SetUserID(c *gin.Context, userID string) {
	c.Set(userIDContextKey, userID)
}

// UserIDFromContext 由业务 handler 调用，从请求上下文读取当前用户 ID。
// 第二个返回值表示是否成功取到有效 userID。
func UserIDFromContext(c *gin.Context) (string, bool) {
	value, ok := c.Get(userIDContextKey)
	if !ok {
		return "", false
	}

	userID, ok := value.(string)
	return userID, ok && userID != ""
}
