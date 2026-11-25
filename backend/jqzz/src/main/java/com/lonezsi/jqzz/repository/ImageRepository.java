package com.lonezsi.jqzz.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.lonezsi.jqzz.model.Image;

public interface ImageRepository extends JpaRepository<Image, Long> {

    // Find public image by handle
    Optional<Image> findByHandleAndOwnerIdIsNull(String handle);

    // Find private/semi-private image by owner and handle
    Optional<Image> findByOwnerIdAndHandle(String ownerId, String handle);

    // Find all images accessible to a user (public + own)
    @Query("SELECT i FROM Image i WHERE i.ownerId IS NULL OR i.ownerId = :userId")
    List<Image> findAllAccessibleByUser(@Param("userId") String userId);

    // Check if a handle is already used by a public image
    boolean existsByHandleAndOwnerIdIsNull(String handle);

    // Check if a handle is already used by a specific user
    boolean existsByOwnerIdAndHandle(String ownerId, String handle);

    // The images someone uploaded, public ones included
    @Query("SELECT i FROM Image i WHERE i.uploadedBy = :userId OR i.ownerId = :userId ORDER BY i.createdAt DESC")
    List<Image> findMine(@Param("userId") String userId);

    long countByUploadedByAndCreatedAtAfter(String uploadedBy, java.time.LocalDateTime after);

    // bytes of pictures kept by one account / by everyone (ImageService.roomFor)
    @Query(value = "SELECT COALESCE(SUM(OCTET_LENGTH(data)), 0) FROM app_image WHERE uploaded_by = :u OR owner_id = :u", nativeQuery = true)
    Number bytesOf(@Param("u") String userId);

    @Query(value = "SELECT COALESCE(SUM(OCTET_LENGTH(data)), 0) FROM app_image", nativeQuery = true)
    Number bytesStored();

    Optional<Image> findFirstByUploadedByAndSourceUrl(String uploadedBy, String sourceUrl);

    boolean existsByIdAndUploadedBy(Long id, String uploadedBy);

    boolean existsByIdAndOwnerId(Long id, String ownerId);
}