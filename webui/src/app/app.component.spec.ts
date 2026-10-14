import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, NgZone } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

@Component({ standalone: true, template: '<p class="routed">routed content</p>' })
class RoutedComponent {}

describe('AppComponent', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([{ path: 'login', component: RoutedComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations()
      ]
    });
  });

  afterEach(() => localStorage.clear());

  it('renders the navigation above the routed content', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(NgZone).run(() => TestBed.inject(Router).navigateByUrl('/login'));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('app-mainnav nav[aria-label="Main"]')).not.toBeNull();
    expect(root.querySelector('main .routed')?.textContent).toBe('routed content');
    const children = Array.from(root.children).map(child => child.tagName.toLowerCase());
    expect(children).toEqual(['app-mainnav', 'main']);
  });

  it('keeps the navigation out of hydration', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-mainnav')?.hasAttribute('ngSkipHydration')).toBeTrue();
  });
});
