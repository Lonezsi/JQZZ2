package com.lonezsi.jqzz.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lonezsi.jqzz.model.Notification;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    /** your latest, newest first */
    List<Notification> findTop100ByUserIdOrderByCreatedAtDescIdDesc(String userId);

    List<Notification> findByUserIdAndReadAtIsNull(String userId);

    List<Notification> findByUserIdAndKindAndFromIdAndReadAtIsNull(String userId, String kind, String fromId);
}
