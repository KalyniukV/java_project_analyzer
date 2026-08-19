package org.springframework.samples.petclinic.model;

import java.util.List;

public class Owner extends Person {
    private String address;
    private String city;
    private String telephone;
    private List<Pet> pets;

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }
    public List<Pet> getPets() { return pets; }
    public void setPets(List<Pet> pets) { this.pets = pets; }
}
