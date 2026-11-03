package com.lonezsi.jqzz.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lonezsi.jqzz.model.Drawing;

public interface DrawingRepository extends JpaRepository<Drawing, Long> {

    Optional<Drawing> findFirstByRecordIdAndArtKey(Long recordId, String artKey);

    java.util.List<Drawing> findByRecordId(Long recordId);
}
