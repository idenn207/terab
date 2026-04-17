package com.terab.api.security;

import java.util.List;
import io.jsonwebtoken.Claims;

public final class ClaimsUtil {
  private ClaimsUtil() {}

  public static String getString(Claims claims, String claimName) {
    return claims.get(claimName, String.class);
  }

  public static List<String> getStringList(Claims claims, String claimName) {
    Object value = claims.get("permissions", List.class);
    if (!(value instanceof List<?> list)) {
      return List.of();
    }
    return list.stream()
      .filter(item -> item instanceof String)
      .map(String.class::cast)
      .toList();
  }
}
