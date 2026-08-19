package org.springframework.samples.petclinic.client;

@Component
public class NotificationClient {
    public void sendAlert(String message) {
        System.out.println("ALERT: " + message);
    }
}
