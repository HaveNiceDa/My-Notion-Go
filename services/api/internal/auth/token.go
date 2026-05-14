package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

var ErrInvalidToken = errors.New("invalid token")

// TokenManager 负责 Access Token 的签发和校验。
// 当前使用轻量 HS256 实现，后续也可以替换成成熟 JWT 库而不影响 Service 层。
type TokenManager struct {
	accessSecret      []byte
	accessTokenExpiry time.Duration
}

// accessClaims 是 Access Token 内部载荷。
// sub 存用户 ID，typ 用来区分 access token，exp/iat 用来控制有效期。
type accessClaims struct {
	Subject   string `json:"sub"`
	Email     string `json:"email"`
	TokenType string `json:"typ"`
	ExpiresAt int64  `json:"exp"`
	IssuedAt  int64  `json:"iat"`
}

func NewTokenManager(accessSecret string, accessTokenExpiry time.Duration) *TokenManager {
	return &TokenManager{
		accessSecret:      []byte(accessSecret),
		accessTokenExpiry: accessTokenExpiry,
	}
}

// IssueAccessToken 为指定用户签发短期 Access Token。
func (m *TokenManager) IssueAccessToken(user User, now time.Time) (string, time.Time, error) {
	expiresAt := now.Add(m.accessTokenExpiry)
	claims := accessClaims{
		Subject:   user.ID,
		Email:     user.Email,
		TokenType: "access",
		ExpiresAt: expiresAt.Unix(),
		IssuedAt:  now.Unix(),
	}

	token, err := m.sign(claims)
	if err != nil {
		return "", time.Time{}, err
	}

	return token, expiresAt, nil
}

// ParseAccessToken 校验 Access Token 并返回用户 ID。
func (m *TokenManager) ParseAccessToken(token string, now time.Time) (string, error) {
	claims, err := m.verify(token)
	if err != nil {
		return "", err
	}
	if claims.TokenType != "access" || claims.Subject == "" {
		return "", ErrInvalidToken
	}
	if now.Unix() >= claims.ExpiresAt {
		return "", ErrInvalidToken
	}

	return claims.Subject, nil
}

func (m *TokenManager) sign(claims accessClaims) (string, error) {
	header := map[string]string{
		"alg": "HS256",
		"typ": "JWT",
	}

	headerJSON, err := json.Marshal(header)
	if err != nil {
		return "", err
	}
	claimsJSON, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}

	encodedHeader := base64.RawURLEncoding.EncodeToString(headerJSON)
	encodedClaims := base64.RawURLEncoding.EncodeToString(claimsJSON)
	signingInput := encodedHeader + "." + encodedClaims
	signature := signHMACSHA256(signingInput, m.accessSecret)

	return signingInput + "." + signature, nil
}

// verify 校验签名并解析 token payload。
// hmac.Equal 用于避免普通字符串比较带来的时序攻击风险。
func (m *TokenManager) verify(token string) (accessClaims, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return accessClaims{}, ErrInvalidToken
	}

	signingInput := parts[0] + "." + parts[1]
	expectedSignature := signHMACSHA256(signingInput, m.accessSecret)
	if !hmac.Equal([]byte(expectedSignature), []byte(parts[2])) {
		return accessClaims{}, ErrInvalidToken
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return accessClaims{}, ErrInvalidToken
	}

	var claims accessClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return accessClaims{}, ErrInvalidToken
	}

	return claims, nil
}

func signHMACSHA256(value string, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(value))

	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

// GenerateRefreshToken 生成高熵随机 refresh token。
// 明文 token 只返回给客户端，服务端入库前会先做哈希。
func GenerateRefreshToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate refresh token: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

// HashRefreshToken 生成 refresh token 的数据库存储值。
// 加上服务端 secret 后再哈希，可以降低数据库单独泄露时的风险。
func HashRefreshToken(token string, secret string) string {
	hash := sha256.Sum256([]byte(token + "." + secret))
	return hex.EncodeToString(hash[:])
}
