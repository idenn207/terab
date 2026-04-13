package com.terab.api.common.exception;

import java.util.stream.Collectors;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<ErrorResponse> handleApiException(ApiException e) {
    return ResponseEntity
      .status(e.getErrorCode().getStatus())
      .body(ErrorResponse.of(e.getErrorCode()));
  }

  @ExceptionHandler(MethodArgumentNotValidException.class)
  public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException e) {
    String message = e.getBindingResult().getFieldErrors().stream()
      .map(f -> f.getField() + ": " + f.getDefaultMessage())
      .collect(Collectors.joining(", "));
    return ResponseEntity.badRequest()
      .body(ErrorResponse.of("VALIDATION_ERROR", message));
  }
}