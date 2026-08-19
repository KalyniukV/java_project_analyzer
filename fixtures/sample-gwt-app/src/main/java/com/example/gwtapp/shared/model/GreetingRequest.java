package com.example.gwtapp.shared.model;

import java.io.Serializable;

public class GreetingRequest implements Serializable {
    private String name;
    private String clientVersion;

    public GreetingRequest() {}

    public GreetingRequest(String name) {
        this.name = name;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
