package org.springframework.samples.petclinic.controller;

import org.springframework.samples.petclinic.model.Owner;
import org.springframework.samples.petclinic.service.OwnerService;
import org.springframework.samples.petclinic.repository.OwnerRepository;

@RestController
public class OwnerController {

    @Autowired
    private OwnerService ownerService;

    @Autowired
    private OwnerRepository ownerRepository; // Architecture Violation: UI directly calls Repository!

    public Owner getOwnerById(Integer id) {
        return ownerService.findOwner(id);
    }
}
