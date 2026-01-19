import { describe, it, expect } from 'vitest'
import { cn } from '@/lib/utils'

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('text-red-500', 'text-blue-500')
    // tailwind-merge keeps the last conflicting class
    expect(result).toBe('text-blue-500')
  })

  it('should handle single class name', () => {
    const result = cn('text-red-500')
    expect(result).toBe('text-red-500')
  })

  it('should handle empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('should handle undefined and null values', () => {
    const result = cn('base-class', undefined, null, 'another-class')
    expect(result).toBe('base-class another-class')
  })

  it('should handle conditional classes with objects', () => {
    const isActive = true
    const isDisabled = false
    const result = cn('base', { active: isActive, disabled: isDisabled })
    expect(result).toContain('base')
    expect(result).toContain('active')
    expect(result).not.toContain('disabled')
  })

  it('should handle arrays of class names', () => {
    const result = cn(['class1', 'class2'], 'class3')
    expect(result).toBe('class1 class2 class3')
  })

  it('should merge Tailwind padding classes correctly', () => {
    const result = cn('p-4', 'p-2')
    expect(result).toBe('p-2')
  })

  it('should merge Tailwind margin classes correctly', () => {
    const result = cn('m-4', 'mx-2')
    expect(result).toBe('m-4 mx-2') // mx is more specific, doesn't conflict with m
  })

  it('should handle responsive variants', () => {
    const result = cn('text-sm', 'md:text-lg', 'lg:text-xl')
    expect(result).toBe('text-sm md:text-lg lg:text-xl')
  })

  it('should handle hover and focus states', () => {
    const result = cn('bg-blue-500', 'hover:bg-blue-600', 'focus:bg-blue-700')
    expect(result).toBe('bg-blue-500 hover:bg-blue-600 focus:bg-blue-700')
  })

  it('should merge conflicting background colors', () => {
    const result = cn('bg-red-500', 'bg-blue-500')
    expect(result).toBe('bg-blue-500')
  })

  it('should handle complex conditional logic', () => {
    const variant = 'primary'
    const size = 'large'
    
    const result = cn(
      'base-button',
      variant === 'primary' && 'bg-primary text-white',
      variant === 'secondary' && 'bg-secondary text-black',
      size === 'large' && 'px-6 py-3',
      size === 'small' && 'px-2 py-1'
    )
    
    expect(result).toBe('base-button bg-primary text-white px-6 py-3')
  })
})
