package org.springframework.samples.petclinic.repository;

import org.springframework.samples.petclinic.model.Owner;
import java.util.List;
import java.util.Optional;

public interface OwnerRepository {
    Optional<Owner> findById(Integer id);
    List<Owner> findByLastName(String lastName);
    void save(Owner owner);
}
