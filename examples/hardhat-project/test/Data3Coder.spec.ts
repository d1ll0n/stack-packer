import { ethers } from 'hardhat';
import { expect } from "chai";

describe('Data3Coder.sol', () => {
	let externalData3: any;

	before(async () => {
		const Factory = await ethers.getContractFactory('ExternalData3Coder');
		externalData3 = await Factory.deploy();
	})

	describe('decode', () => {
		it('Should be able to get min/max values', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			7
			"
			,
			 
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			0
			0
			0
			0
			"
			,
			 
			t
			r
			u
			e
			,
			 
			f
			a
			l
			s
			e
			)
			;
			const { myEnum, a, b, c, d, x } = await externalData3.decode()
			expect(myEnum).to.eq("0x07");
			expect(a).to.eq("0x00");
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
			expect(d).to.eq(true);
			expect(x).to.eq(false);
		});

		it('Should be able to get max/min values', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			f
			f
			f
			f
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			f
			f
			f
			f
			"
			,
			 
			f
			a
			l
			s
			e
			,
			 
			t
			r
			u
			e
			)
			;
			const { myEnum, a, b, c, d, x } = await externalData3.decode()
			expect(myEnum).to.eq("0x00");
			expect(a).to.eq("0xffff");
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
			expect(d).to.eq(false);
			expect(x).to.eq(true);
		});
	})

	describe('encode', () => {
		it('Reverts when myEnum overflows', async () => {
			await expect(
			externalData3.encode("0x0f", "0x00", "-0x8000", "-0x80000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when a overflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x01ffff", "-0x8000", "-0x80000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b overflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x00", "0x7fffff", "-0x80000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x00", "-0x800000", "-0x80000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c overflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x00", "-0x8000", "0x7fffffffff", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData3.encode("0x00", "0x00", "-0x8000", "-0x8000000000", false, false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData3.encode("0x07", "0x00", "0x7fff", "-0x80000000", true, false)
			c
			o
			n
			s
			t
			 
			{
			 
			m
			y
			E
			n
			u
			m
			,
			 
			a
			,
			 
			b
			,
			 
			c
			,
			 
			d
			,
			 
			x
			 
			}
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(myEnum).to.eq("0x07");
			expect(a).to.eq("0x00");
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
			expect(d).to.eq(true);
			expect(x).to.eq(false);
		});

		it('Should be able to set max/min values', async () => {
			externalData3.encode("0x00", "0xffff", "-0x8000", "0x7fffffff", false, true)
			c
			o
			n
			s
			t
			 
			{
			 
			m
			y
			E
			n
			u
			m
			,
			 
			a
			,
			 
			b
			,
			 
			c
			,
			 
			d
			,
			 
			x
			 
			}
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(myEnum).to.eq("0x00");
			expect(a).to.eq("0xffff");
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
			expect(d).to.eq(false);
			expect(x).to.eq(true);
		});
	})

	describe('setAbc', () => {
		it('Reverts when a overflows', async () => {
			await expect(
			externalData3.setAbc("0x01ffff", "-0x8000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b overflows', async () => {
			await expect(
			externalData3.setAbc("0x00", "0x7fffff", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData3.setAbc("0x00", "-0x800000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c overflows', async () => {
			await expect(
			externalData3.setAbc("0x00", "-0x8000", "0x7fffffffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData3.setAbc("0x00", "-0x8000", "-0x8000000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData3.setAbc("0xffff", "-0x8000", "0x7fffffff")
			c
			o
			n
			s
			t
			 
			{
			 
			a
			,
			 
			b
			,
			 
			c
			 
			}
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(a).to.eq("0xffff");
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to set max/min values', async () => {
			externalData3.setAbc("0x00", "0x7fff", "-0x80000000")
			c
			o
			n
			s
			t
			 
			{
			 
			a
			,
			 
			b
			,
			 
			c
			 
			}
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(a).to.eq("0x00");
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('setCba', () => {
		it('Reverts when b overflows', async () => {
			await expect(
			externalData3.setCba(false, "0x7fffff", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData3.setCba(false, "-0x800000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c overflows', async () => {
			await expect(
			externalData3.setCba(false, "-0x8000", "0x7fffffffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData3.setCba(false, "-0x8000", "-0x8000000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData3.setCba(true, "-0x8000", "0x7fffffff")
			c
			o
			n
			s
			t
			 
			{
			 
			x
			,
			 
			b
			,
			 
			c
			 
			}
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(x).to.eq(true);
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to set max/min values', async () => {
			externalData3.setCba(false, "0x7fff", "-0x80000000")
			c
			o
			n
			s
			t
			 
			{
			 
			x
			,
			 
			b
			,
			 
			c
			 
			}
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(x).to.eq(false);
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('getMyEnum', () => {
		it('Should be able to get min value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			7
			"
			,
			 
			"
			0
			x
			0
			0
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			0
			0
			0
			0
			"
			,
			 
			f
			a
			l
			s
			e
			,
			 
			f
			a
			l
			s
			e
			)
			;
			const myEnum = await externalData3.getMyEnum()
			expect(myEnum).to.eq("0x07");
		});

		it('Should be able to get max value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			f
			f
			f
			f
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			f
			f
			f
			f
			"
			,
			 
			t
			r
			u
			e
			,
			 
			t
			r
			u
			e
			)
			;
			const myEnum = await externalData3.getMyEnum()
			expect(myEnum).to.eq("0x00");
		});
	})

	describe('setMyEnum', () => {
		it('Reverts when myEnum overflows', async () => {
			await expect(
			externalData3.setMyEnum("0x0f")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData3.setMyEnum("0x07")
			c
			o
			n
			s
			t
			 
			m
			y
			E
			n
			u
			m
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(myEnum).to.eq("0x07");
		});

		it('Should be able to set max value', async () => {
			externalData3.setMyEnum("0x00")
			c
			o
			n
			s
			t
			 
			m
			y
			E
			n
			u
			m
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(myEnum).to.eq("0x00");
		});
	})

	describe('getA', () => {
		it('Should be able to get min value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			f
			f
			f
			f
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			0
			0
			0
			0
			"
			,
			 
			f
			a
			l
			s
			e
			,
			 
			f
			a
			l
			s
			e
			)
			;
			const a = await externalData3.getA()
			expect(a).to.eq("0xffff");
		});

		it('Should be able to get max value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			7
			"
			,
			 
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			f
			f
			f
			f
			"
			,
			 
			t
			r
			u
			e
			,
			 
			t
			r
			u
			e
			)
			;
			const a = await externalData3.getA()
			expect(a).to.eq("0x00");
		});
	})

	describe('setA', () => {
		it('Reverts when a overflows', async () => {
			await expect(
			externalData3.setA("0x01ffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData3.setA("0xffff")
			c
			o
			n
			s
			t
			 
			a
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(a).to.eq("0xffff");
		});

		it('Should be able to set max value', async () => {
			externalData3.setA("0x00")
			c
			o
			n
			s
			t
			 
			a
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(a).to.eq("0x00");
		});
	})

	describe('getB', () => {
		it('Should be able to get min value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			0
			0
			0
			0
			"
			,
			 
			f
			a
			l
			s
			e
			,
			 
			f
			a
			l
			s
			e
			)
			;
			const b = await externalData3.getB()
			expect(b).to.eq("0x7fff");
		});

		it('Should be able to get max value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			7
			"
			,
			 
			"
			0
			x
			f
			f
			f
			f
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			f
			f
			f
			f
			"
			,
			 
			t
			r
			u
			e
			,
			 
			t
			r
			u
			e
			)
			;
			const b = await externalData3.getB()
			expect(b).to.eq("-0x8000");
		});
	})

	describe('setB', () => {
		it('Reverts when b overflows', async () => {
			await expect(
			externalData3.setB("0x7fffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData3.setB("-0x800000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData3.setB("0x7fff")
			c
			o
			n
			s
			t
			 
			b
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(b).to.eq("0x7fff");
		});

		it('Should be able to set max value', async () => {
			externalData3.setB("-0x8000")
			c
			o
			n
			s
			t
			 
			b
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(b).to.eq("-0x8000");
		});
	})

	describe('getC', () => {
		it('Should be able to get min value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			0
			0
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			f
			f
			f
			f
			"
			,
			 
			f
			a
			l
			s
			e
			,
			 
			f
			a
			l
			s
			e
			)
			;
			const c = await externalData3.getC()
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to get max value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			7
			"
			,
			 
			"
			0
			x
			f
			f
			f
			f
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			0
			0
			0
			0
			"
			,
			 
			t
			r
			u
			e
			,
			 
			t
			r
			u
			e
			)
			;
			const c = await externalData3.getC()
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('setC', () => {
		it('Reverts when c overflows', async () => {
			await expect(
			externalData3.setC("0x7fffffffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData3.setC("-0x8000000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData3.setC("0x7fffffff")
			c
			o
			n
			s
			t
			 
			c
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to set max value', async () => {
			externalData3.setC("-0x80000000")
			c
			o
			n
			s
			t
			 
			c
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('getD', () => {
		it('Should be able to get min value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			0
			0
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			0
			0
			0
			0
			"
			,
			 
			t
			r
			u
			e
			,
			 
			f
			a
			l
			s
			e
			)
			;
			const d = await externalData3.getD()
			expect(d).to.eq(true);
		});

		it('Should be able to get max value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			7
			"
			,
			 
			"
			0
			x
			f
			f
			f
			f
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			f
			f
			f
			f
			"
			,
			 
			f
			a
			l
			s
			e
			,
			 
			t
			r
			u
			e
			)
			;
			const d = await externalData3.getD()
			expect(d).to.eq(false);
		});
	})

	describe('setD', () => {
		it('Should be able to set min value', async () => {
			externalData3.setD(true)
			c
			o
			n
			s
			t
			 
			d
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(d).to.eq(true);
		});

		it('Should be able to set max value', async () => {
			externalData3.setD(false)
			c
			o
			n
			s
			t
			 
			d
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(d).to.eq(false);
		});
	})

	describe('getX', () => {
		it('Should be able to get min value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			0
			"
			,
			 
			"
			0
			x
			0
			0
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			"
			,
			 
			"
			-
			0
			x
			8
			0
			0
			0
			0
			0
			0
			0
			"
			,
			 
			f
			a
			l
			s
			e
			,
			 
			t
			r
			u
			e
			)
			;
			const x = await externalData3.getX()
			expect(x).to.eq(true);
		});

		it('Should be able to get max value', async () => {
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			e
			n
			c
			o
			d
			e
			(
			"
			0
			x
			0
			7
			"
			,
			 
			"
			0
			x
			f
			f
			f
			f
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			"
			,
			 
			"
			0
			x
			7
			f
			f
			f
			f
			f
			f
			f
			"
			,
			 
			t
			r
			u
			e
			,
			 
			f
			a
			l
			s
			e
			)
			;
			const x = await externalData3.getX()
			expect(x).to.eq(false);
		});
	})

	describe('setX', () => {
		it('Should be able to set min value', async () => {
			externalData3.setX(true)
			c
			o
			n
			s
			t
			 
			x
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(x).to.eq(true);
		});

		it('Should be able to set max value', async () => {
			externalData3.setX(false)
			c
			o
			n
			s
			t
			 
			x
			 
			=
			 
			a
			w
			a
			i
			t
			 
			e
			x
			t
			e
			r
			n
			a
			l
			D
			a
			t
			a
			3
			.
			d
			e
			c
			o
			d
			e
			(
			)
			;
			expect(x).to.eq(false);
		});
	})
})