const defaultBaseUrl = "http://localhost:8080";
const viteEnv = (import.meta as unknown as {
  env?: Record<string, string | undefined>;
}).env;

// 后端统一用 Envelope 包装响应，前端只在 client 层拆壳，页面组件不用关心 success/data/error 细节。
type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
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
	parentId: string | null;
	title: string;
	icon: string;
	coverImage: string;
	isArchived: boolean;
	isStarred: boolean;
	isPublished: boolean;
	isInKnowledgeBase: boolean;
	position: number;
	path: string;
	createdAt: string;
	updatedAt: string;
};

export type DocumentTreeNode = Document & {
	children: DocumentTreeNode[];
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

const baseUrl = viteEnv?.VITE_API_BASE_URL ?? defaultBaseUrl;

// request 是所有 API 调用的唯一出口，统一处理 baseUrl、JSON header、Bearer token 和错误拆包。
async function request<T>(
  path: string,
  options: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { accessToken, headers, ...fetchOptions } = options;
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
    throw new ApiError(
      envelope.error?.message ?? `HTTP ${response.status}`,
      response.status,
      envelope.error?.code,
    );
  }

  // 后端成功响应必须包含 data；这里集中断言类型，业务组件可以直接拿到强类型结果。
  return envelope.data as T;
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

	archive(documentId: string, accessToken: string) {
		return request<{ message: string }>(`/api/v1/documents/${documentId}/archive`, {
			method: "POST",
			accessToken,
		});
	},
};

export const apiClient = {
  baseUrl,
  request,
  auth: authApi,
	documents: documentApi,
};
