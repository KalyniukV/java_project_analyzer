package org.springframework.samples.petclinic.model;

public abstract class BaseEntity {
    private Integer id;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }
}
