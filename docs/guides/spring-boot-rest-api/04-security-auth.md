# Security / Auth Layer

> JWT 기반 인증 + RBAC 권한 검증. terab은 `리소스:액션` 형식 권한 체계를 사용한다.

## 요약 테이블

| 어노테이션/설정 | 중요도 | 역할 | 적용 위치 | 주의사항 |
|---|---|---|---|---|
| `@EnableWebSecurity` | ★★★ | Spring Security 활성화 | 클래스 | `SecurityConfig`에 1회만 |
| `@SecurityFilterChain` | ★★★ | 필터 체인 빈 등록 | 메서드 | — |
| `@EnableMethodSecurity` | ★★★ | 메서드 레벨 보안 활성화 | 클래스 | `@PreAuthorize` 사용 전제 조건 |
| `@PreAuthorize` | ★★★ | 메서드 레벨 권한 검증 (SpEL) | 메서드 | `@EnableMethodSecurity` 필요 |
| `@Secured` | ★★☆ | 역할 기반 접근 제어 (단순) | 메서드 | SpEL 불가, `@PreAuthorize` 권장 |
| `@AuthenticationPrincipal` | ★★★ | 현재 인증 사용자 주입 | 파라미터 | `UserDetails` 구현체 직접 수신 |
| `permitAll` / `authenticated` | ★★★ | URL 패턴별 접근 제어 | 설정 | 구체적 규칙 → 일반 규칙 순서 |

---

## SecurityFilterChain 기본 구성

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity  // @PreAuthorize 사용을 위해 필수
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                            JwtAuthenticationFilter jwtFilter) throws Exception {
        return http
                .csrf(AbstractHttpConfigurer::disable)      // JWT 사용 시 CSRF 불필요
                .sessionManagement(s -> s
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**").permitAll()   // 인증 없이 접근
                        .requestMatchers("/api/shares/**").permitAll() // 공유 링크 접근
                        .anyRequest().authenticated())                  // 나머지는 인증 필요
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }
}
```

> **URL 규칙 순서:** 구체적인 패턴(예: `/api/auth/**`)을 먼저 선언해야 한다.
> `anyRequest()`는 항상 마지막에 위치해야 한다.

---

## JWT 필터 체인 동작 원리

```
요청 → JwtAuthenticationFilter → SecurityContext에 Authentication 설정
                                → Controller (@AuthenticationPrincipal로 사용자 접근)
```

```java
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtProvider jwtProvider;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && jwtProvider.validateToken(token)) {
            String userId = jwtProvider.getUserId(token);
            UserDetails userDetails = userDetailsService.loadUserByUsername(userId);
            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(
                            userDetails, null, userDetails.getAuthorities());
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }
}
```

---

## @PreAuthorize — RBAC 권한 검증

terab의 `리소스:액션` 권한 형식과 연동:

```java
@RestController
@RequestMapping("/api/files")
public class FileController {

    @PreAuthorize("hasAuthority('file:read')")
    @GetMapping("/{id}")
    public ResponseEntity<FileResponse> getFile(@PathVariable UUID id) { ... }

    @PreAuthorize("hasAuthority('file:write')")
    @PostMapping
    public ResponseEntity<FileResponse> uploadFile(@RequestBody @Valid UploadFileRequest req) { ... }

    @PreAuthorize("hasAuthority('file:delete')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteFile(@PathVariable UUID id) { ... }
}

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    @PreAuthorize("hasAuthority('user:manage')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deactivateUser(@PathVariable UUID id) { ... }

    @PreAuthorize("hasAuthority('user:role')")
    @PostMapping("/{id}/roles")
    public ResponseEntity<Void> assignRole(@PathVariable UUID id,
                                           @RequestBody AssignRoleRequest request) { ... }
}
```

### SpEL 표현식 예시

```java
// 권한 OR 조건
@PreAuthorize("hasAuthority('file:write') or hasAuthority('share:manage')")

// 역할 기반 (terab은 권한 기반 권장)
@PreAuthorize("hasRole('ADMIN')")  // ROLE_ prefix 자동 추가

// 현재 사용자 조건
@PreAuthorize("#userId == authentication.principal.id")
public ResponseEntity<Void> deleteOwnAccount(@PathVariable UUID userId) { ... }
```

---

## @AuthenticationPrincipal

SecurityContext의 인증 사용자를 Controller 파라미터로 직접 주입:

```java
@GetMapping("/me")
public ResponseEntity<UserResponse> getMyProfile(
        @AuthenticationPrincipal CustomUserDetails userDetails) {
    return ResponseEntity.ok(userService.findById(userDetails.getId()));
}

@PostMapping
public ResponseEntity<FileResponse> uploadFile(
        @RequestBody @Valid UploadFileRequest request,
        @AuthenticationPrincipal CustomUserDetails userDetails) {
    request.setOwnerId(userDetails.getId());
    return ResponseEntity.status(HttpStatus.CREATED)
            .body(fileService.upload(request));
}
```

> `CustomUserDetails`는 `UserDetails`를 구현한 terab 클래스. `getId()`, `getEmail()` 등 프로젝트 전용 메서드를 제공한다.

---

## CORS 설정

terab은 프론트엔드 컨테이너 내부 Nginx에서 `/api/**`를 백엔드로 프록시하므로 **CORS 불필요**. 직접 호출이 필요한 경우(테스트, 모바일):

```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://drive.skypark207.com"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", config);
    return source;
}
```
