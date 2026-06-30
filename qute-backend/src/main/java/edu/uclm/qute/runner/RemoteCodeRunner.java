package edu.uclm.qute.runner;

import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.client.RestTemplate;

public class RemoteCodeRunner {

    /**
     * Executes a Python script remotely via the centralized proxy.
     * 
     * The proxy receives the code list and forwards it to the remote runner server.
     * URL pattern: proxyUrl?url=remoteRunnerUrl
     * 
     * Request body: List<String> with a single code entry
     * Response: {"results": [{"stdout": "..."}]}
     */
    public static QuantumRunnerResult execute(String scriptContent, String proxyUrl, String remoteRunnerUrl) {
        try {
            String url = proxyUrl + "?url=" + remoteRunnerUrl;

            List<String> codes = new ArrayList<>();
            codes.add(scriptContent);

            RestTemplate restTemplate = new RestTemplate();
            HttpEntity<List<String>> request = new HttpEntity<>(codes);
            ResponseEntity<String> response = restTemplate.postForEntity(new URI(url), request, String.class);

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return new QuantumRunnerResult(-1, "",
                        "Error from Proxy: " + response.getStatusCode());
            }

            JSONObject responseJson = new JSONObject(response.getBody());

            if (responseJson.optString("error", null) != null) {
                return new QuantumRunnerResult(-1, "",
                        "Remote runner error: " + responseJson.getString("error"));
            }

            JSONArray resultsArray = responseJson.getJSONArray("results");
            if (resultsArray.length() == 0) {
                return new QuantumRunnerResult(-1, "", "No results returned from remote runner");
            }

            JSONObject firstResult = resultsArray.getJSONObject(0);
            String stdout = firstResult.optString("stdout", "");
            String stderr = firstResult.optString("stderr", "");

            return new QuantumRunnerResult(0, stdout, stderr);

        } catch (Exception e) {
            return new QuantumRunnerResult(-1, "",
                    "Failed remote execution via proxy: " + e.getMessage());
        }
    }
}
