package org.springframework.samples.petclinic.service;

import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.repository.OwnerRepository;

@Service
public class OwnerService {

    @Autowired
    private OwnerRepository ownerRepository;

    public Owner findOwner(Integer id) {
        return ownerRepository.findById(id).orElse(null);
    }

    public void registerOwner(Owner owner) {
        ownerRepository.save(owner);
    }
}
