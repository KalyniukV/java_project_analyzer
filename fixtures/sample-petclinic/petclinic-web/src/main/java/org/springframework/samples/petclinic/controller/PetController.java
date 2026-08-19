package org.springframework.samples.petclinic.controller;

import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.service.PetService;

@RestController
public class PetController {

    @Autowired
    private PetService petService;

    public void process(Pet pet) {
        petService.processPet(pet);
    }
}
