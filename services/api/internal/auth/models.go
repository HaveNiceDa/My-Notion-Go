package auth

import "time"

// User 是数据库模型，对应 users 表。
// 它包含 password_hash 等内部字段，只用于服务端持久化和业务逻辑，不应该直接返回给前端。
type User struct {
	ID           string     `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Email        string     `gorm:"not null;unique"`
	Name         string     `gorm:"not null;default:''"`
	PasswordHash string     `gorm:"not null"`
	AvatarURL    string     `gorm:"not null;default:''"`
	CreatedAt    time.Time  `gorm:"not null"`
	UpdatedAt    time.Time  `gorm:"not null"`
	DeletedAt    *time.Time `gorm:"index"`
}

func (User) TableName() string {
	return "users"
}

// RefreshToken 是数据库模型，对应 refresh_tokens 表。
// 数据库只保存 token_hash，不保存明文 refresh token，降低数据库泄露后的登录态风险。
type RefreshToken struct {
	ID         string     `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID     string     `gorm:"type:uuid;not null;index"`
	TokenHash  string     `gorm:"not null;unique"`
	DeviceName string     `gorm:"not null;default:''"`
	IPAddress  string     `gorm:"not null;default:''"`
	UserAgent  string     `gorm:"not null;default:''"`
	ExpiresAt  time.Time  `gorm:"not null;index"`
	RevokedAt  *time.Time `gorm:"index"`
	CreatedAt  time.Time  `gorm:"not null"`
	UpdatedAt  time.Time  `gorm:"not null"`
}

func (RefreshToken) TableName() string {
	return "refresh_tokens"
}

// UserDTO 是返回给前端的用户视图模型。
// DTO 表示 Data Transfer Object，只暴露 API 响应需要的安全字段，避免泄露 password_hash、deleted_at 等内部字段。
type UserDTO struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	AvatarURL string    `json:"avatarUrl"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// NewUserDTO 将数据库模型转换成 API 响应模型。
// 后续如果 User 表增加内部字段，只要不放进 DTO，就不会意外返回给前端。
func NewUserDTO(user User) UserDTO {
	return UserDTO{
		ID:        user.ID,
		Email:     user.Email,
		Name:      user.Name,
		AvatarURL: user.AvatarURL,
		CreatedAt: user.CreatedAt,
		UpdatedAt: user.UpdatedAt,
	}
}
