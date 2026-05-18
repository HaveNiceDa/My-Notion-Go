const defaultBaseUrl = "http://localhost:8080";
const processEnv = (globalThis as unknown as {
  process?: {
    env?: Record<string, string | undefined>;
  };
}).process?.env;

// 后端统一用 Envelope 包装响应，前端只在 client 层拆壳，页面组件不用关心 success/data/error 细节。
type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
};

export const apiUnauthorizedEventName = "my-notion-go:api-unauthorized";

export type ApiUnauthorizedEventDetail = {
  path: string;
  status: number;
  code: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type TokenPair = {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

export type AuthResult = {
  user: User;
  tokens: TokenPair;
};

export type RegisterRequest = {
  email: string;
  name?: string;
  password: string;
};

export type LoginRequest = {
  email: string;
  password: string;
  deviceName?: string;
};

export type Document = {
	id: string;
	publicId: string;
	parentId: string | null;
	title: string;
	icon: string;
	coverImage: string;
	isArchived: boolean;
	isStarred: boolean;
	isPublished: boolean;
	isInKnowledgeBase: boolean;
	position: number;
	starredPosition: number | null;
	path: string;
	createdAt: string;
	updatedAt: string;
};

export type DocumentTreeNode = Document & {
	children: DocumentTreeNode[];
};

export type DocumentSearchResult = {
	document: Document;
	matchType: "title" | "content";
	preview: string;
};

export type PublicDocument = {
	publicId: string;
	title: string;
	icon: string;
	coverImage: string;
	content: unknown[];
	updatedAt: string;
};

export type SearchDocumentsOptions = {
	includeArchived?: boolean;
	limit?: number;
	signal?: AbortSignal;
};

export type CreateDocumentRequest = {
	parentId?: string;
	title?: string;
	icon?: string;
	coverImage?: string;
};

export type UpdateDocumentRequest = {
	title?: string;
	icon?: string;
	coverImage?: string;
	isStarred?: boolean;
	isInKnowledgeBase?: boolean;
	parentId?: string;
};

export type DocumentContent = {
	documentId: string;
	content: unknown[];
	contentHash: string;
	version: number;
	updatedAt: string;
};

export type UpdateDocumentContentRequest = {
	content: unknown[];
};

export type AIConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type AIMessageRole = "user" | "assistant" | "system" | "tool";

export type AIMessage = {
  id: string;
  conversationId: string;
  role: AIMessageRole;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type CreateAIConversationRequest = {
  title?: string;
};

export type StreamAIChatRequest = {
  conversationId?: string;
  message: string;
  model?: string;
};

export type RAGDocumentStatus = {
	documentId: string;
	isInKnowledgeBase: boolean;
	status: "pending" | "indexing" | "indexed" | "failed" | "disabled";
	chunkCount: number;
	lastError: string;
	indexedAt?: string | null;
	updatedAt?: string | null;
};

// ApiError 保留 HTTP 状态码和业务错误码，方便页面做提示，也方便后续按 code 做分支处理。
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code = "REQUEST_FAILED") {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

const baseUrl = processEnv?.EXPO_PUBLIC_API_BASE_URL ?? processEnv?.VITE_API_BASE_URL ?? defaultBaseUrl;

// request 是所有 API 调用的唯一出口，统一处理 baseUrl、JSON header、Bearer token 和错误拆包。
async function request<T>(
  path: string,
  options: RequestInit & { accessToken?: string; suppressUnauthorizedEvent?: boolean } = {},
): Promise<T> {
  const { accessToken, headers, suppressUnauthorizedEvent = false, ...fetchOptions } = options;
  const response = await fetch(`${baseUrl}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
  });

  // 即使服务端异常返回了非 JSON，也转成稳定的 ApiError，避免组件层处理 JSON parse 异常。
  const envelope = (await response.json().catch(() => ({
    success: false,
    error: {
      code: "INVALID_RESPONSE",
      message: "Server returned an invalid response.",
    },
  }))) as ApiEnvelope<T>;

  if (!response.ok || !envelope.success) {
    if (response.status === 401 && accessToken && !suppressUnauthorizedEvent) {
      notifyUnauthorized({
        path,
        status: response.status,
        code: envelope.error?.code ?? "UNAUTHORIZED",
      });
    }
    throw new ApiError(
      envelope.error?.message ?? `HTTP ${response.status}`,
      response.status,
      envelope.error?.code,
    );
  }

  // 后端成功响应必须包含 data；这里集中断言类型，业务组件可以直接拿到强类型结果。
  return envelope.data as T;
}

export function notifyUnauthorized(detail: ApiUnauthorizedEventDetail) {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent<ApiUnauthorizedEventDetail>(apiUnauthorizedEventName, { detail }));
}

export const authApi = {
  register(input: RegisterRequest) {
    return request<AuthResult>("/api/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  login(input: LoginRequest) {
    return request<AuthResult>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  refresh(refreshToken: string) {
    return request<AuthResult>("/api/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },

  logout(refreshToken: string) {
    return request<{ message: string }>("/api/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
  },

  me(accessToken: string) {
    return request<User>("/api/v1/me", {
      method: "GET",
      accessToken,
      suppressUnauthorizedEvent: true,
    });
  },
};

export const documentApi = {
	create(input: CreateDocumentRequest, accessToken: string) {
		return request<Document>("/api/v1/documents", {
			method: "POST",
			accessToken,
			body: JSON.stringify(input),
		});
	},

	tree(accessToken: string) {
		return request<DocumentTreeNode[]>("/api/v1/documents/tree", {
			method: "GET",
			accessToken,
		});
	},

	trash(accessToken: string) {
		return request<Document[]>("/api/v1/documents/trash", {
			method: "GET",
			accessToken,
		});
	},

	search(query: string, accessToken: string, options: SearchDocumentsOptions = {}) {
		const params = new URLSearchParams({
			q: query,
			limit: String(options.limit ?? 20),
		});
		if (options.includeArchived) {
			params.set("includeArchived", "true");
		}
		return request<DocumentSearchResult[]>(`/api/v1/documents/search?${params.toString()}`, {
			method: "GET",
			accessToken,
			signal: options.signal,
		});
	},

	get(documentId: string, accessToken: string) {
		return request<Document>(`/api/v1/documents/${documentId}`, {
			method: "GET",
			accessToken,
		});
	},

	update(documentId: string, input: UpdateDocumentRequest, accessToken: string) {
		return request<Document>(`/api/v1/documents/${documentId}`, {
			method: "PATCH",
			accessToken,
			body: JSON.stringify(input),
		});
	},

	updateFavoritesOrder(orderedIds: string[], accessToken: string) {
		return request<{ message: string }>("/api/v1/documents/favorites/order", {
			method: "PUT",
			accessToken,
			body: JSON.stringify({ orderedIds }),
		});
	},

	publish(documentId: string, accessToken: string) {
		return request<Document>(`/api/v1/documents/${documentId}/publish`, {
			method: "POST",
			accessToken,
		});
	},

	unpublish(documentId: string, accessToken: string) {
		return request<Document>(`/api/v1/documents/${documentId}/publish`, {
			method: "DELETE",
			accessToken,
		});
	},

	archive(documentId: string, accessToken: string) {
		return request<{ message: string }>(`/api/v1/documents/${documentId}/archive`, {
			method: "POST",
			accessToken,
		});
	},

	restore(documentId: string, accessToken: string) {
		return request<{ message: string }>(`/api/v1/documents/${documentId}/restore`, {
			method: "POST",
			accessToken,
		});
	},

	delete(documentId: string, accessToken: string) {
		return request<{ message: string }>(`/api/v1/documents/${documentId}`, {
			method: "DELETE",
			accessToken,
		});
	},

	content(documentId: string, accessToken: string) {
		return request<DocumentContent>(`/api/v1/documents/${documentId}/content`, {
			method: "GET",
			accessToken,
		});
	},

	updateContent(documentId: string, input: UpdateDocumentContentRequest, accessToken: string, options: RequestInit = {}) {
		return request<DocumentContent>(`/api/v1/documents/${documentId}/content`, {
			...options,
			method: "PUT",
			accessToken,
			body: JSON.stringify(input),
		});
	},
};

export const publicDocumentApi = {
	get(publicId: string) {
		return request<PublicDocument>(`/api/v1/public/documents/${publicId}`, {
			method: "GET",
		});
	},
};

export const aiChatApi = {
  conversations(accessToken: string) {
    return request<AIConversation[]>("/api/v1/ai/conversations", {
      method: "GET",
      accessToken,
    });
  },

  createConversation(input: CreateAIConversationRequest, accessToken: string) {
    return request<AIConversation>("/api/v1/ai/conversations", {
      method: "POST",
      accessToken,
      body: JSON.stringify(input),
    });
  },

  messages(conversationId: string, accessToken: string) {
    return request<AIMessage[]>(`/api/v1/ai/conversations/${conversationId}/messages`, {
      method: "GET",
      accessToken,
    });
  },
};

export const ragApi = {
	status(documentId: string, accessToken: string) {
		return request<RAGDocumentStatus>(`/api/v1/rag/documents/${documentId}/status`, {
			method: "GET",
			accessToken,
		});
	},

	enable(documentId: string, accessToken: string, options: RequestInit = {}) {
		return request<RAGDocumentStatus>(`/api/v1/rag/documents/${documentId}/index`, {
			...options,
			method: "POST",
			accessToken,
		});
	},

	disable(documentId: string, accessToken: string, options: RequestInit = {}) {
		return request<RAGDocumentStatus>(`/api/v1/rag/documents/${documentId}/index`, {
			...options,
			method: "DELETE",
			accessToken,
		});
	},
};

export const apiClient = {
  baseUrl,
  request,
  auth: authApi,
	documents: documentApi,
  aiChat: aiChatApi,
	rag: ragApi,
};
