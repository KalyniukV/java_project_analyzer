package com.example.gwtapp.client.presenter;

import com.example.gwtapp.client.service.GreetingService;
import com.example.gwtapp.client.service.GreetingServiceAsync;
import com.example.gwtapp.client.view.GreetingView;
import com.example.gwtapp.shared.model.GreetingRequest;
import com.example.gwtapp.shared.model.GreetingResponse;

public class GreetingPresenter {
    private final GreetingServiceAsync greetingService = GWT.create(GreetingService.class);
    private final GreetingView view;

    public GreetingPresenter(GreetingView view) {
        this.view = view;
    }

    public void onSendButtonClicked() {
        GreetingRequest request = new GreetingRequest(view.getName());
        greetingService.greetServer(request, new AsyncCallback<GreetingResponse>() {
            public void onSuccess(GreetingResponse result) {
                view.setGreeting(result.getServerMessage());
            }

            public void onFailure(Throwable caught) {
            }
        });
    }
}
