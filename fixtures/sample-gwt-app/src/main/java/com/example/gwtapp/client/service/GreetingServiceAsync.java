package com.example.gwtapp.client.service;

import com.example.gwtapp.shared.model.GreetingRequest;
import com.example.gwtapp.shared.model.GreetingResponse;

public interface GreetingServiceAsync {
    void greetServer(GreetingRequest request, AsyncCallback<GreetingResponse> callback);
}
