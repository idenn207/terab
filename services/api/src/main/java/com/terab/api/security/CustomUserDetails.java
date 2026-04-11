package com.terab.api.security;

import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public class CustomUserDetails implements UserDetails {

  private final UUID userId;
  private final String username;
  private final List<String> permissions;

  @Override
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return permissions.stream()
    .map(SimpleGrantedAuthority::new)
    .collect(Collectors.toList());
  }

  @Override public String getPassword() { return null; };
  @Override public boolean isAccountNonExpired() { return true; };
  @Override public boolean isAccountNonLocked() { return true; };
  @Override public boolean isCredentialsNonExpired() { return true; };
  @Override public boolean isEnabled() { return true; };
}
