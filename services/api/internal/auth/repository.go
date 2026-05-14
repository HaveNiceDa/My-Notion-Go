package auth

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

var ErrNotFound = errors.New("record not found")

// Repository 封装 Auth 模块的数据库访问。
// Service 层只调用这里的方法，不直接拼 GORM 查询，方便后续替换存储或补单元测试。
type Repository struct {
	db *gorm.DB
}

// NewRepository 注入共享的 GORM 连接。
// 这个连接由 cmd/api/main.go 在服务启动时创建和关闭。
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// CreateUser 创建 users 表记录。
// 密码必须在 Service 层提前 hash 后再传进来。
func (r *Repository) CreateUser(ctx context.Context, user *User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// FindUserByEmail 按邮箱查询未软删除用户。
// 找不到时统一转换为业务侧 ErrNotFound，避免上层直接依赖 GORM 的错误类型。
func (r *Repository) FindUserByEmail(ctx context.Context, email string) (User, error) {
	var user User
	err := r.db.WithContext(ctx).
		Where("email = ? AND deleted_at IS NULL", email).
		First(&user).
		Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, ErrNotFound
	}

	return user, err
}

// FindUserByID 按用户 ID 查询未软删除用户。
// GET /api/v1/me 会使用它把 token 中的 userID 转成用户资料。
func (r *Repository) FindUserByID(ctx context.Context, userID string) (User, error) {
	var user User
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", userID).
		First(&user).
		Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return User{}, ErrNotFound
	}

	return user, err
}

// CreateRefreshToken 保存 refresh token 的哈希值。
// 明文 refresh token 只返回给前端，不会落库。
func (r *Repository) CreateRefreshToken(ctx context.Context, token *RefreshToken) error {
	return r.db.WithContext(ctx).Create(token).Error
}

// FindActiveRefreshTokenByHash 查找仍然有效的 refresh token。
// 条件包含：哈希匹配、未撤销、未过期。
func (r *Repository) FindActiveRefreshTokenByHash(ctx context.Context, tokenHash string, now time.Time) (RefreshToken, error) {
	var token RefreshToken
	err := r.db.WithContext(ctx).
		Where("token_hash = ? AND revoked_at IS NULL AND expires_at > ?", tokenHash, now).
		First(&token).
		Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return RefreshToken{}, ErrNotFound
	}

	return token, err
}

// RevokeRefreshToken 通过设置 revoked_at 撤销 refresh token。
// 这里不物理删除记录，方便后续做安全审计和设备管理。
func (r *Repository) RevokeRefreshToken(ctx context.Context, tokenID string, revokedAt time.Time) error {
	return r.db.WithContext(ctx).
		Model(&RefreshToken{}).
		Where("id = ? AND revoked_at IS NULL", tokenID).
		Update("revoked_at", revokedAt).
		Error
}
