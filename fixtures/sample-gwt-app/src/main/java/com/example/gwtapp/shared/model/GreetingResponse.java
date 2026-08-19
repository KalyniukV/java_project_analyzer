package com.example.gwtapp.shared.model;

import java.io.Serializable;

public class GreetingResponse implements Serializable {
    private String serverMessage;
    private String userAgent;
    private long serverTime;

    public GreetingResponse() {}

    public GreetingResponse(String message, String userAgent, long serverTime) {
        this.serverMessage = message;
        this.userAgent = userAgent;
        this.serverTime = serverTime;
    }

    public String getServerMessage() {
        return serverMessage;
    }

    public void setServerMessage(String serverMessage) {
        this.serverMessage = serverMessage;
    }
}
