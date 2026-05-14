package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// Envelope 是 API 的统一响应外壳。
// 成功时写 data，失败时写 error，前端可以用 success 统一判断请求结果。
type Envelope struct {
	Success bool       `json:"success"`
	Data    any        `json:"data,omitempty"`
	Error   *ErrorBody `json:"error,omitempty"`
}

// ErrorBody 是业务错误响应体。
// code 面向程序判断，message 面向人类阅读。
type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// OK 返回 200 成功响应。
func OK(c *gin.Context, data any) {
	c.JSON(http.StatusOK, Envelope{
		Success: true,
		Data:    data,
	})
}

// Created 返回 201 创建成功响应。
// 例如注册用户、创建文档这类“新资源已创建”的场景。
func Created(c *gin.Context, data any) {
	c.JSON(http.StatusCreated, Envelope{
		Success: true,
		Data:    data,
	})
}

// Error 返回统一错误响应。
// status 是 HTTP 状态码，code 是稳定的业务错误码。
func Error(c *gin.Context, status int, code string, message string) {
	c.JSON(status, Envelope{
		Success: false,
		Error: &ErrorBody{
			Code:    code,
			Message: message,
		},
	})
}
