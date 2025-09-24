import { Directive, HostListener, Input } from '@angular/core';
import { ToastrService } from 'ngx-toastr';

@Directive({
  selector: '[appUnderDevelopment]',
  standalone: true  // ✅ Important for Angular 15+ standalone structure
})
export class UnderDevelopmentDirective {
  @Input() message: string = 'This feature is under development.';

  constructor(private toastr: ToastrService) {}

  @HostListener('click', ['$event'])
  onClick(event: Event) {
    event.preventDefault();
    this.toastr.info(this.message, 'Info');
  }
}
