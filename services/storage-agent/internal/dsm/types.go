package dsm

// CreateTargetRequest 는 NestJS 가 agent 에 보내는 target 생성 요청. types.ts 와 1:1.
type CreateTargetRequest struct {
	// IQN 명명 규칙: iqn.YYYY-MM.com.terab:{drive-id}
	IQN string `json:"iqn"`
	// 사용자에게 노출되는 표시명. SAN Manager UI 의 "이름" 컬럼.
	Name string `json:"name"`
	// CHAP 자격증명. mount_credentials.osUsername / secretRef 에 매핑.
	OSUsername string `json:"osUsername"`
	OSPassword string `json:"osPassword"`
}

// Target 은 SYNO.Core.ISCSI.Target 의 응답을 평탄화한 형태.
type Target struct {
	IQN       string `json:"iqn"`
	Name      string `json:"name"`
	Status    string `json:"status"`
	Connected bool   `json:"connected"`
}

// TargetID 는 DSM 내부 식별자 (정수). IQN 과 별도 키.
type TargetID int64
