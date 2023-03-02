import axios, {AxiosInstance} from "axios";
import {SsmService} from "../service/ssm-service";

export class ClientBase {
    protected maxRetriesPerQuery = 3;

    async createInstance(baseUrl: string, apiKeyPath: string, contentType: string = "application/json"): Promise<AxiosInstance> {
        try {
            const apiKeyValue = await SsmService.fetchSSMParameterValue(apiKeyPath, true);
            return axios.create({
                baseURL: baseUrl,
                headers: {
                    "X-API-Key": apiKeyValue,
                    "Content-Type": contentType
                }
            });
        } catch (err) {
            console.error(err);
            throw new Error(`Error fetching API Key from ${apiKeyPath}`);
        }
    }

    /**
     * Get request. Each query is retried for maxRetriesPerQuery times in case of error.
     */
    async getRequest(client: AxiosInstance, url: string, params: object = {},
                                     retry: number = 1): Promise<any> {
        try {
            const response = await client.get(url, { params: params });
            return response.data;
        } catch (err) {
            const queryParams = JSON.stringify(params).substring(0, 100);
            console.error(`Request ${client.getUri() + url} with params ${queryParams}... responded with error (retry: ${retry}):`);
            const errorMsg = this.processErrorAndExtractMessage(err, client.getUri() + url);
            if (retry < this.maxRetriesPerQuery) {
                await this.exponentialTimeout(retry);
                return await this.getRequest(client, url, params, retry + 1);
            } else {
                throw new Error(errorMsg);
            }

        }
    }

    /**
     * Post request. Each query is retried for maxRetriesPerQuery times in case of error.
     */
    async postRequest(client: AxiosInstance, url: string, data: object, retry: number = 1): Promise<any> {
        try {
            const response = await client.post(url, data);
            return response.data;
        } catch (err) {
            const queryData = JSON.stringify(data).substring(0, 100);
            console.error(`Request ${client.getUri() + url} with data ${queryData} responded with error (retry: ${retry}):`);
            const errorMsg = this.processErrorAndExtractMessage(err, client.getUri() + url);
            if (retry < this.maxRetriesPerQuery) {
                await this.exponentialTimeout(retry);
                return await this.postRequest(client, url, data, retry + 1);
            } else {
                throw new Error(errorMsg);
            }
        }
    }

    processErrorAndExtractMessage(error: any, url: string): string {
        if (axios.isAxiosError(error)) {
            console.error(error.response?.data);
            return `Error happened during fetch of ${url} (${error.response?.status}: ${error.response?.statusText.substring(0, 100)})`;
        } else {
            console.error(error);
            return `Error happened during fetch of ${url}`;
        }
    }

    protected async exponentialTimeout(retry: number) {
        const waitMillis = Math.pow(retry, 2) * 500;
        return new Promise(resolve => setTimeout(resolve, waitMillis));
    }
}
