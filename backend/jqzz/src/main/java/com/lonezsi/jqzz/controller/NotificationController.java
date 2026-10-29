package com.lonezsi.jqzz.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.lonezsi.jqzz.service.NotificationService;

/**
 * Your notifications (X-User-Id says whose).
 *
 * GET  /notifications              the latest 100, newest first, read or not
 * POST /notifications/{id}/read    that one's read
 * POST /notifications/read-all     all of them are
 */
@RestController
@RequestMapping("/notifications")
public class NotificationController {

    private final NotificationService notifications;

    public NotificationController(NotificationService notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    public List<Map<String, Object>> list(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        return notifications.list(require(userId));
    }

    @PostMapping("/{id}/read")
    public List<Map<String, Object>> read(@RequestHeader(value = "X-User-Id", required = false) String userId,
                                          @PathVariable Long id) {
        notifications.read(require(userId), id);
        return notifications.list(userId);
    }

    @PostMapping("/read-all")
    public List<Map<String, Object>> readAll(@RequestHeader(value = "X-User-Id", required = false) String userId) {
        notifications.readAll(require(userId));
        return notifications.list(userId);
    }

    private static String require(String userId) {
        if (userId == null || userId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "userId is required");
        }
        return userId;
    }
}
