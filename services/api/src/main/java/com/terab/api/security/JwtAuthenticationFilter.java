package com.terab.api.security;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {
  protected final String authType = "Bearer";
  private final JwtProvider jwtProvider;

  @Override
  protected void doFilterInternal(
    HttpServletRequest request,
    HttpServletResponse response,
    FilterChain filterChain
  ) throws ServletException, IOException {
    String authHeader = request.getHeader("Authorization");
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
      filterChain.doFilter(request, response);
      return;
    }

    String token = authHeader.substring(7);
    try {
      Claims claims = jwtProvider.validateAndGetClaims(token);
      UUID userId = UUID.fromString(claims.getSubject());
      String username = ClaimsUtil.getString(claims, "username");
      List<String> permissions = ClaimsUtil.getStringList(claims, "permissions");

      CustomUserDetails userDetails = new CustomUserDetails(userId, username, permissions);
      UsernamePasswordAuthenticationToken auth =
        new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
      auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
      SecurityContextHolder.getContext().setAuthentication(auth);
    } catch (JwtException ignored) {
      // 유효하지 않은 토큰 - SecurityConfig에서 인증 실패 처리
    }
    
    filterChain.doFilter(request, response);
  }
}
