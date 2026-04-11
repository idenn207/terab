package com.terab.api.security;

import java.util.List;
import java.util.stream.Collectors;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.terab.api.rbac.domain.Permission;
import com.terab.api.user.domain.User;
import com.terab.api.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {
  
  private final UserRepository userRepository;

  @Override
  @Transactional(readOnly = true)
  public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
    User user = userRepository.findByUsername(username).orElseThrow(() -> new UsernameNotFoundException("User not found: "+ username));
    
    List<String> permissions = user.getRoles().stream()
    .flatMap(r -> r.getPermissions().stream())
    .map(Permission::toPermissionString)
    .distinct()
    .collect(Collectors.toList());

    return new CustomUserDetails(user.getId(), user.getUsername(), permissions);
  }
}
