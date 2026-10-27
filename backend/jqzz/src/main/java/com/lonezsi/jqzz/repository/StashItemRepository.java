package com.lonezsi.jqzz.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.lonezsi.jqzz.model.StashItem;
import com.lonezsi.jqzz.model.StashKind;

public interface StashItemRepository extends JpaRepository<StashItem, Long> {

    List<StashItem> findBySavedByOrderByCreatedAtDesc(String savedBy);

    Optional<StashItem> findByKindAndHandleAndOwnerIdIsNull(StashKind kind, String handle);

    Optional<StashItem> findByKindAndOwnerIdAndHandle(StashKind kind, String ownerId, String handle);

    boolean existsByKindAndHandleAndOwnerIdIsNull(StashKind kind, String handle);

    boolean existsByKindAndOwnerIdAndHandle(StashKind kind, String ownerId, String handle);

    boolean existsBySavedByAndKindAndImageId(String savedBy, StashKind kind, Long imageId);

    List<StashItem> findTop200ByKindAndOwnerIdIsNullOrderByCreatedAtDesc(StashKind kind);

    List<StashItem> findBySavedByAndOwnerIdIsNullOrderByCreatedAtDesc(String savedBy);
}
