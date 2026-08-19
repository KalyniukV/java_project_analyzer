package org.springframework.samples.petclinic.service;

import org.springframework.samples.petclinic.model.Pet;
import org.springframework.samples.petclinic.client.NotificationClient;

@Service
public class PetService {

    @Autowired
    private NotificationClient notificationClient;

    public void processPet(Pet pet) {
        notificationClient.sendAlert("Processed pet: " + pet.getName());
    }
}
