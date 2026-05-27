package dsm

import "errors"

// ErrNotFound 는 요청한 IQN 의 target 이 존재하지 않을 때 반환.
// HTTP 레이어가 404 로 매핑.
var ErrNotFound = errors.New("dsm: target not found")

// ErrConflict 는 동일 IQN 이 이미 존재해 생성이 거부될 때 반환.
// HTTP 레이어가 409 로 매핑.
var ErrConflict = errors.New("dsm: target already exists")
