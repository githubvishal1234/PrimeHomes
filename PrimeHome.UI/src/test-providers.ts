import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

// Shared by every spec (angular.json → test.options.providersFile).
export default [provideRouter([]), provideHttpClient(), provideHttpClientTesting()];
