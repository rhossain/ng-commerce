import { Pipe, PipeTransform } from '@angular/core';

/*
Usage of this Pipe

# {{ 'Angular' | charInitials }} Output: 'A'
# {{ 'Angular' | charInitials:{take: 2} }} Output: 'An'
# {{ 'Angular Framework' | charInitials:{allWords: true} }} Output: 'AF'
# {{ 'Angular Framework' | charInitials:{take: 2, allWords: true, joinWith: '.'} }} Output: 'An.Fr'
# {{ 'angular framework' | charInitials:{take: 2, allWords: true, uppercase: true} }} Output: 'ANFR'
*/

@Pipe({
  name: 'charInitials'
})
export class CharInitialsPipe implements PipeTransform {

  transform(
    value: string, 
    options: {
      take?: number,         // Number of characters to take (1 or 2)
      allWords?: boolean,    // Whether to process all words
      uppercase?: boolean,  // Whether to uppercase result
      joinWith?: string     // Joiner for multiple words (default '')
    } = {}
  ): string {
    if (!value) return '';

    // Set defaults
    const take = Math.min(Math.max(options.take || 1, 1), 2);
    const allWords = options.allWords || false;
    const uppercase = options.uppercase || false;
    const joinWith = options.joinWith || '';

    let result = '';

    if (allWords) {
      result = value.split(' ')
                   .filter(word => word.length > 0)
                   .map(word => word.substring(0, take))
                   .join(joinWith);
    } else {
      result = value.substring(0, take);
    }

    return uppercase ? result.toUpperCase() : result;
  }

}
