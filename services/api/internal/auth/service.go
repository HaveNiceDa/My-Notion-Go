package auth

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

var (
	ErrEmailAlreadyExists = errors.New("email already exists")
	ErrInvalidCredential  = errors.New("invalid email or password")
	ErrInvalidInput       = errors.New("invalid input")
)

// Service 承载 Auth 业务规则。
// Handler 只负责 HTTP 入参和响应，Repository 只负责数据库读写，核心流程放在 Service 里。
type Service struct {
	repo            *Repository
	tokenManager    *TokenManager
	refreshSecret   string
	refreshTokenTTL time.Duration
}

// RegisterInput 是注册用例的内部入参，避免 Service 直接依赖 Gin 的 HTTP request struct。
type RegisterInput struct {
	Email    string
	Name     string
	Password string
}

// LoginInput 除了账号密码，也保留设备和请求来源信息，方便后续做设备管理或安全审计。
type LoginInput struct {
	Email      string
	Password   string
	DeviceName string
	IPAddress  string
	UserAgent  string
}

// TokenPair 是一次登录态签发的结果。
// Access Token 给前端短期访问 API，Refresh Token 用来在 Access Token 过期后续期。
type TokenPair struct {
	AccessToken           string    `json:"accessToken"`
	AccessTokenExpiresAt  time.Time `json:"accessTokenExpiresAt"`
	RefreshToken          string    `json:"refreshToken"`
	RefreshTokenExpiresAt time.Time `json:"refreshTokenExpiresAt"`
}

// AuthResult 是注册、登录、刷新 token 的统一响应体。
type AuthResult struct {
	User   UserDTO   `json:"user"`
	Tokens TokenPair `json:"tokens"`
}

func NewService(repo *Repository, tokenManager *TokenManager, refreshSecret string, refreshTokenTTL time.Duration) *Service {
	return &Service{
		repo:            repo,
		tokenManager:    tokenManager,
		refreshSecret:   refreshSecret,
		refreshTokenTTL: refreshTokenTTL,
	}
}

// Register 创建用户并直接签发登录态。
// 注意：密码只保存 bcrypt hash，永远不把明文密码落库。
func (s *Service) Register(ctx context.Context, input RegisterInput) (AuthResult, error) {
	email := normalizeEmail(input.Email)
	name := strings.TrimSpace(input.Name)
	password := input.Password
	if !isValidEmail(email) || len(password) < 8 {
		return AuthResult{}, ErrInvalidInput
	}

	_, err := s.repo.FindUserByEmail(ctx, email)
	if err == nil {
		return AuthResult{}, ErrEmailAlreadyExists
	}
	if !errors.Is(err, ErrNotFound) {
		return AuthResult{}, err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return AuthResult{}, err
	}

	user := User{
		Email:        email,
		Name:         name,
		PasswordHash: string(passwordHash),
	}
	if err := s.repo.CreateUser(ctx, &user); err != nil {
		return AuthResult{}, err
	}

	tokens, err := s.issueTokenPair(ctx, user, LoginInput{})
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{
		User:   NewUserDTO(user),
		Tokens: tokens,
	}, nil
}

// Login 校验邮箱和密码，成功后签发新的 Access Token 和 Refresh Token。
func (s *Service) Login(ctx context.Context, input LoginInput) (AuthResult, error) {
	email := normalizeEmail(input.Email)
	if !isValidEmail(email) || input.Password == "" {
		return AuthResult{}, ErrInvalidCredential
	}

	user, err := s.repo.FindUserByEmail(ctx, email)
	if errors.Is(err, ErrNotFound) {
		return AuthResult{}, ErrInvalidCredential
	}
	if err != nil {
		return AuthResult{}, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password)); err != nil {
		return AuthResult{}, ErrInvalidCredential
	}

	tokens, err := s.issueTokenPair(ctx, user, input)
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{
		User:   NewUserDTO(user),
		Tokens: tokens,
	}, nil
}

// Refresh 使用有效的 refresh token 换一组新 token。
// 这里会撤销旧 refresh token，减少同一个 refresh token 被重复使用的风险。
func (s *Service) Refresh(ctx context.Context, refreshToken string) (AuthResult, error) {
	now := time.Now()
	tokenHash := HashRefreshToken(refreshToken, s.refreshSecret)
	storedToken, err := s.repo.FindActiveRefreshTokenByHash(ctx, tokenHash, now)
	if errors.Is(err, ErrNotFound) {
		return AuthResult{}, ErrInvalidToken
	}
	if err != nil {
		return AuthResult{}, err
	}

	user, err := s.repo.FindUserByID(ctx, storedToken.UserID)
	if errors.Is(err, ErrNotFound) {
		return AuthResult{}, ErrInvalidToken
	}
	if err != nil {
		return AuthResult{}, err
	}

	if err := s.repo.RevokeRefreshToken(ctx, storedToken.ID, now); err != nil {
		return AuthResult{}, err
	}

	tokens, err := s.issueTokenPair(ctx, user, LoginInput{
		DeviceName: storedToken.DeviceName,
		IPAddress:  storedToken.IPAddress,
		UserAgent:  storedToken.UserAgent,
	})
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{
		User:   NewUserDTO(user),
		Tokens: tokens,
	}, nil
}

// Logout 撤销 refresh token。
// 如果 token 本来就无效或已经过期，直接视为退出成功，避免暴露 token 状态细节。
func (s *Service) Logout(ctx context.Context, refreshToken string) error {
	now := time.Now()
	tokenHash := HashRefreshToken(refreshToken, s.refreshSecret)
	storedToken, err := s.repo.FindActiveRefreshTokenByHash(ctx, tokenHash, now)
	if errors.Is(err, ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}

	return s.repo.RevokeRefreshToken(ctx, storedToken.ID, now)
}

// GetUser 根据鉴权中间件解析出的 userID 返回当前用户信息。
func (s *Service) GetUser(ctx context.Context, userID string) (UserDTO, error) {
	user, err := s.repo.FindUserByID(ctx, userID)
	if errors.Is(err, ErrNotFound) {
		return UserDTO{}, ErrInvalidToken
	}
	if err != nil {
		return UserDTO{}, err
	}

	return NewUserDTO(user), nil
}

// issueTokenPair 统一处理 Access Token 和 Refresh Token 的签发与入库。
// Refresh Token 明文只返回给前端一次，数据库只保存哈希。
func (s *Service) issueTokenPair(ctx context.Context, user User, input LoginInput) (TokenPair, error) {
	now := time.Now()
	accessToken, accessExpiresAt, err := s.tokenManager.IssueAccessToken(user, now)
	if err != nil {
		return TokenPair{}, err
	}

	refreshToken, err := GenerateRefreshToken()
	if err != nil {
		return TokenPair{}, err
	}

	refreshExpiresAt := now.Add(s.refreshTokenTTL)
	storedToken := RefreshToken{
		UserID:     user.ID,
		TokenHash:  HashRefreshToken(refreshToken, s.refreshSecret),
		DeviceName: strings.TrimSpace(input.DeviceName),
		IPAddress:  strings.TrimSpace(input.IPAddress),
		UserAgent:  strings.TrimSpace(input.UserAgent),
		ExpiresAt:  refreshExpiresAt,
	}
	if err := s.repo.CreateRefreshToken(ctx, &storedToken); err != nil {
		return TokenPair{}, err
	}

	return TokenPair{
		AccessToken:           accessToken,
		AccessTokenExpiresAt:  accessExpiresAt,
		RefreshToken:          refreshToken,
		RefreshTokenExpiresAt: refreshExpiresAt,
	}, nil
}

func normalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func isValidEmail(email string) bool {
	_, err := mail.ParseAddress(email)
	return err == nil
}
