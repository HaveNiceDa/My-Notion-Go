package documents

import (
	"encoding/json"
	"time"
)

// Document 是数据库模型，对应 documents 表。
// 它只保存文档元信息和树结构，正文 JSON 独立放在 document_contents 表，避免侧边栏树查询加载大字段。
type Document struct {
	ID                string  `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	UserID            string  `gorm:"type:uuid;not null;index"`
	ParentID          *string `gorm:"type:uuid;index"`
	Title             string  `gorm:"not null"`
	Icon              string  `gorm:"not null;default:''"`
	CoverImage        string  `gorm:"not null;default:''"`
	IsArchived        bool    `gorm:"not null;default:false"`
	IsStarred         bool    `gorm:"not null;default:false"`
	IsPublished       bool    `gorm:"not null;default:false"`
	IsInKnowledgeBase bool    `gorm:"not null;default:true"`
	Position          float64 `gorm:"not null;default:0"`
	StarredPosition   *float64
	// Path 是一条用 / 拼接的祖先路径，例如 rootID/childID/grandChildID。
	// 有了 path 后，归档/删除整棵子树可以通过 path LIKE 'root/%' 一次更新，不需要递归查库。
	Path string `gorm:"not null;default:''"`

	// GORM 会自动维护 CreatedAt / UpdatedAt；数据库侧也有 trigger 刷新 updated_at，双保险保证时间一致。
	CreatedAt time.Time  `gorm:"not null"`
	UpdatedAt time.Time  `gorm:"not null"`
	DeletedAt *time.Time `gorm:"index"`
}

func (Document) TableName() string {
	return "documents"
}

// DocumentContent 是数据库模型，对应 document_contents 表。
// 第一版 Document CRUD 只初始化空正文，真正的编辑器保存会在 Editor/Content 阶段扩展。
type DocumentContent struct {
	DocumentID string `gorm:"type:uuid;primaryKey"`
	// Content 用 []byte 承载 JSONB，GORM 会把它作为原始 JSON 写入 PostgreSQL。
	// 这里默认是 []，对应编辑器还没有任何 block 的初始状态。
	Content     []byte    `gorm:"type:jsonb;not null;default:'[]'::jsonb"`
	ContentHash string    `gorm:"not null;default:''"`
	Version     int64     `gorm:"not null;default:1"`
	CreatedAt   time.Time `gorm:"not null"`
	UpdatedAt   time.Time `gorm:"not null"`
}

func (DocumentContent) TableName() string {
	return "document_contents"
}

// DocumentContentDTO 是编辑器正文接口的响应模型。
// Content 保持原始 JSON 字节，Handler 返回时会作为 JSON 对象/数组写出，而不是变成字符串。
type DocumentContentDTO struct {
	DocumentID  string          `json:"documentId"`
	Content     json.RawMessage `json:"content"`
	ContentHash string          `json:"contentHash"`
	Version     int64           `json:"version"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

// DocumentDTO 是返回给前端的文档元信息视图。
// DTO 的作用是隔离数据库模型：API 只暴露前端需要的字段，不直接把 GORM model 原样返回。
type DocumentDTO struct {
	ID                string    `json:"id"`
	ParentID          *string   `json:"parentId"`
	Title             string    `json:"title"`
	Icon              string    `json:"icon"`
	CoverImage        string    `json:"coverImage"`
	IsArchived        bool      `json:"isArchived"`
	IsStarred         bool      `json:"isStarred"`
	IsPublished       bool      `json:"isPublished"`
	IsInKnowledgeBase bool      `json:"isInKnowledgeBase"`
	Position          float64   `json:"position"`
	StarredPosition   *float64  `json:"starredPosition"`
	Path              string    `json:"path"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

// DocumentTreeDTO 在 DocumentDTO 基础上递归携带子文档，用于侧边栏文档树。
type DocumentTreeDTO struct {
	// 匿名嵌入 DocumentDTO 后，JSON 会把 DocumentDTO 的字段平铺到当前对象，而不是多包一层 document。
	DocumentDTO
	Children []DocumentTreeDTO `json:"children"`
}

// DocumentSearchResultDTO 给命令面板使用，保留命中文档和最小匹配信息。
// 未来替换为 ES 时可以继续维持这个 API 形状，避免前端感知底层搜索引擎变化。
type DocumentSearchResultDTO struct {
	Document  DocumentDTO `json:"document"`
	MatchType string      `json:"matchType"`
	Preview   string      `json:"preview"`
}

// NewDocumentDTO 把数据库模型转换成 API 响应模型。
// 这层转换看起来有点“多”，但后续数据库字段变多时，可以避免意外暴露内部状态。
func NewDocumentDTO(document Document) DocumentDTO {
	return DocumentDTO{
		ID:                document.ID,
		ParentID:          document.ParentID,
		Title:             document.Title,
		Icon:              document.Icon,
		CoverImage:        document.CoverImage,
		IsArchived:        document.IsArchived,
		IsStarred:         document.IsStarred,
		IsPublished:       document.IsPublished,
		IsInKnowledgeBase: document.IsInKnowledgeBase,
		Position:          document.Position,
		StarredPosition:   document.StarredPosition,
		Path:              document.Path,
		CreatedAt:         document.CreatedAt,
		UpdatedAt:         document.UpdatedAt,
	}
}

// NewDocumentContentDTO 把数据库正文模型转成 API 响应模型。
// 这里不解析具体 block 结构，让后端只负责 JSONB 存取，BlockNote schema 由前端控制。
func NewDocumentContentDTO(content DocumentContent) DocumentContentDTO {
	return DocumentContentDTO{
		DocumentID:  content.DocumentID,
		Content:     json.RawMessage(content.Content),
		ContentHash: content.ContentHash,
		Version:     content.Version,
		UpdatedAt:   content.UpdatedAt,
	}
}
