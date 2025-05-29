import { Injectable } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, Observable, shareReplay, startWith } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RouteUtilsService {
  currentUrl$: Observable<string>;

  constructor(private router: Router) {
    this.currentUrl$ = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
      shareReplay(1)
    );
  }

  isCurrentRoute(route: string): Observable<boolean> {
    return this.currentUrl$.pipe(map(url => url === route));
  }

  includesRoute(routePart: string): Observable<boolean> {
    return this.currentUrl$.pipe(map(url => url.includes(routePart)));
  }

  getCurrentUrl(): string {
    return this.router.url;
  }
}
