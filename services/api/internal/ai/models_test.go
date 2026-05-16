package ai

import "testing"

func TestNormalizeModelID_BitsUT(t *testing.T) {
	// 模型名是前端可传入参数，单测覆盖默认值、白名单和拒绝路径，防止未来误放开任意模型调用。
	tests := []struct {
		name      string
		input     string
		wantModel string
		wantOK    bool
	}{
		{
			name:      "空模型使用默认模型",
			input:     "",
			wantModel: DefaultModelID,
			wantOK:    true,
		},
		{
			name:      "白名单模型保持原值",
			input:     "qwen3.6-27b",
			wantModel: "qwen3.6-27b",
			wantOK:    true,
		},
		{
			name:      "非法模型被拒绝",
			input:     "unknown-model",
			wantModel: "",
			wantOK:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotModel, gotOK := NormalizeModelID(tt.input)
			if gotModel != tt.wantModel {
				t.Fatalf("unexpected model: want %q, got %q", tt.wantModel, gotModel)
			}
			if gotOK != tt.wantOK {
				t.Fatalf("unexpected ok flag: want %v, got %v", tt.wantOK, gotOK)
			}
		})
	}
}

func TestAvailableModelsIncludesDefaultModel_BitsUT(t *testing.T) {
	t.Run("默认模型必须出现在可选模型列表中", func(t *testing.T) {
		// 默认模型如果不在列表里，前端首次打开会显示一个后端无法校验通过的模型。
		for _, model := range AvailableModels {
			if model.ID == DefaultModelID {
				return
			}
		}
		t.Fatalf("default model %q should be listed in AvailableModels", DefaultModelID)
	})
}
