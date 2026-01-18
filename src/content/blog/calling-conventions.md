---
title: 'Calling Conventions'
description: 'Analyzing and looking at the differences between common calling conventions'
pubDate: '2026-01-18'
heroImage: '../../assets/cdecl_fixed.jpg'
---


Understanding the various calling conventions provided by the Visual C/C++ compiler is essential for debugging your programs and understanding how your code interfaces with assembly routines. This guide delves into some of the most common calling conventions, explaining how arguments are passed, how values are returned, and the concept of naked function calls.

## Topics Covered:
- How Arguments Are Passed
- How Values Are Returned
- Naked Function Calls

### The x86 Stack
In the x86 architecture, the stack grows downwards in memory. When values are pushed onto the stack, the stack pointer (`ESP`) decrements.

### Choosing a C++ Compiler
Not all compilers support all conventions. Keywords or specifiers referring to unsupported conventions are ignored, and the platform defaults to its standard convention.

## Function Skeleton
```c++
void calltype MyFunc(char c, short s, int i, double f);
void MyFunc(char c, short s, int i, double f) {
    // Function body
}
MyFunc('x', 12, 8192, 2.7183);
```

On x86 systems, arguments are widened to 32 bits when passed. Return values are also widened to 32 bits and returned in the `EAX` register, except for 8-byte structures, which use the `EDX:EAX` register pair. Larger structures are returned as pointers in the `EAX` register. Parameters are pushed onto the stack from right to left. Non-POD (Plain Old Data) structures are not returned in registers.

## Passing Integers Example
```assembly
add:
    push ebp           
    mov  ebp, esp      ; Function prologue

    mov  eax, [ebp+8]  ; Get first argument (a)
    add  eax, [ebp+12] ; Add second argument (b)

    mov  esp, ebp      
    pop  ebp           ; Epilogue
    ret                ; Return result in EAX

; Function Call
push 5               ; Second argument (b)
push 10              ; First argument (a)
call add             ; Call the function
add  esp, 8          ; Clean up stack (2 arguments * 4 bytes)
```

## Calling Conventions

### `__cdecl`
- Default calling convention for C/C++.
- Arguments are pushed from right to left.
- Caller cleans the stack.
- Uses an underscore (`_`) as a prefix for name decoration.

The `__cdecl` calling convention is the default and most commonly used in C/C++ programming. Its flexibility allows for variable argument functions like `printf`, making it a versatile choice. However, the responsibility of stack cleanup lies with the caller, which can introduce complexity in large programs.

```c++
struct MyClass {
    void __cdecl method1();
}
void MyClass::method1() { return; }

// Equivalent
void __cdecl MyClass::method1() { return; }
```

### Examples
```c++
// Function declaration
int __cdecl system(const char *);

// Function pointer
typedef BOOL (__cdecl *funcname_ptr)(void *arg1, const char *arg2, DWORD flags, ...);
```

### `__clrcall`
- Managed code only.
- Optimizes calls between managed functions.
- Avoids double thunking for virtual functions.

The `__clrcall` calling convention is tailored for managed code, enhancing performance by eliminating unnecessary transitions to native code. This is especially beneficial for virtual functions within managed environments, ensuring smoother and faster function calls.

```c++
// clrcall2.cpp
// compile with: /clr
using namespace System;

int __clrcall Func1() {
   Console::WriteLine("in Func1");
   return 0;
}

int (__clrcall *pf)() = &Func1;

int main() {
   if (&Func1 == pf)
      Console::WriteLine("&Func1 == pf, comparison succeeds");
   else
      Console::WriteLine("&Func1 != pf, comparison fails");

   pf();
   Func1();
}
```

### `__stdcall`
- Used for Win32 API functions.
- Arguments are pushed from right to left.
- Callee cleans the stack.
- Decorated with an underscore (`_`) and an `@` followed by the number of bytes in the argument list.

The `__stdcall` calling convention is primarily used for Win32 API functions, simplifying stack management by making the callee responsible for cleaning the stack. This can lead to more efficient function calls, especially in complex API interactions.

```c++
struct MyClass {
    void __stdcall method1();
}
void MyClass::method1() { return; }

// Equivalent
void __stdcall MyClass::method1() { return; }
```

### Examples
```c++
// Function declaration
#define WINAPI __stdcall

// Function pointer
typedef BOOL (__stdcall *funcname_ptr)(void *arg1, const char *arg2, DWORD flags, ...);
```

### `__fastcall`
- Arguments passed via registers (`ECX` and `EDX`).
- Applies only to x86 architecture.
- Additional arguments are pushed onto the stack from right to left.

The `__fastcall` calling convention optimizes function calls by passing the first two arguments in registers, significantly speeding up the execution. This is especially useful in performance-critical applications where function call overhead needs to be minimized.

```c++
struct MyClass {
    void __fastcall method1();
}
void MyClass::method1() { return; }

// Equivalent
void __fastcall MyClass::method1() { return; }
```

### Examples
```c++
// Function declaration
#define FASTCALL __fastcall

void FASTCALL DeleteAggrWrapper(void *pWrapper);

// Function pointer
typedef BOOL (__fastcall *funcname_ptr)(void *arg1, const char *arg2, DWORD flags, ...);
```

### `__thiscall`
- Used for C++ class member functions in x86 architecture.
- Arguments are pushed onto the stack from right to left.
- The `this` pointer is stored in `ECX`.

The `__thiscall` calling convention is specific to C++ member functions, ensuring that the `this` pointer is correctly handled in the `ECX` register. This is crucial for maintaining object-oriented programming principles within low-level code.

```c++
class MyClass {
public:
    int data;
    void __thiscall MyMemberFunction(int x, int y) {
        data = x + y;
    }
};
```

### Example in Assembly
```assembly
_MyClass::MyMemberFunction:
    push ebp
    mov ebp, esp
    mov eax, [ebp + 8]  ; Get first argument (x)
    add eax, [ebp + 12] ; Add second argument (y)
    mov edx, [ecx]      ; Access the 'this' pointer in ECX and get 'data'
    mov [edx], eax      ; Store the result in 'data'
    mov esp, ebp
    pop ebp
    ret 8               ; Clean up the stack (8 bytes for 2 arguments)
```

## Naked Function Calls
The `naked` keyword allows custom prolog/epilog sequences, providing flexibility for performance-critical code where standard function prologues and epilogues are not suitable.

### Example
```c++
// the__local_size_symbol.cpp
// processor: x86
__declspec(naked) int main() {
   int i;
   int j;

   __asm {      /* prolog */
      push   ebp
      mov    ebp, esp
      sub    esp, __LOCAL_SIZE
   }

   /* Function body */

   __asm {   /* epilog */
      mov    esp, ebp
      pop    ebp
      ret
   }
}
```

## Conclusion
Mastering calling conventions in Visual C/C++ is crucial for any programmer working with low-level code or interfacing with assembly. Each convention offers unique advantages, from optimizing performance with `__fastcall` to ensuring compatibility with managed code using `__clrcall`. Understanding these conventions allows for more efficient and effective programming, enabling developers to write code that is both performant and maintainable.

By familiarizing yourself with these conventions, you can enhance your debugging capabilities and optimize your applications. Whether you are working on a performance-critical application or maintaining legacy code, knowing how to leverage these calling conventions will significantly improve your coding proficiency.
