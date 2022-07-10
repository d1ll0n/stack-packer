import { ethers } from 'hardhat';
import { expect } from "chai";

describe('Data2Coder.sol', () => {
	let externalData2: any;

	before(async () => {
		const Factory = await ethers.getContractFactory('ExternalData2Coder');
		externalData2 = await Factory.deploy();
	})

	describe('setAbc', () => {
		it('Reverts when a overflows', async () => {
			await expect(
			externalData2.setAbc("0x01ffff", "-0x8000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b overflows', async () => {
			await expect(
			externalData2.setAbc("0x00", "0x7fffff", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData2.setAbc("0x00", "-0x800000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c overflows', async () => {
			await expect(
			externalData2.setAbc("0x00", "-0x8000", "0x7fffffffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData2.setAbc("0x00", "-0x8000", "-0x8000000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData2.setAbc("0xffff", "-0x8000", "0x7fffffff")
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
			2
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
			externalData2.setAbc("0x00", "0x7fff", "-0x80000000")
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
			2
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
		it('Reverts when c overflows', async () => {
			await expect(
			externalData2.setCba("0x7fffffffff", "-0x8000", "0x00")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData2.setCba("-0x8000000000", "-0x8000", "0x00")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b overflows', async () => {
			await expect(
			externalData2.setCba("-0x80000000", "0x7fffff", "0x00")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData2.setCba("-0x80000000", "-0x800000", "0x00")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when a overflows', async () => {
			await expect(
			externalData2.setCba("-0x80000000", "-0x8000", "0x01ffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData2.setCba("0x7fffffff", "-0x8000", "0xffff")
			c
			o
			n
			s
			t
			 
			{
			 
			c
			,
			 
			b
			,
			 
			a
			 
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
			2
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
			expect(b).to.eq("-0x8000");
			expect(a).to.eq("0xffff");
		});

		it('Should be able to set max/min values', async () => {
			externalData2.setCba("-0x80000000", "0x7fff", "0x00")
			c
			o
			n
			s
			t
			 
			{
			 
			c
			,
			 
			b
			,
			 
			a
			 
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
			2
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
			expect(b).to.eq("0x7fff");
			expect(a).to.eq("0x00");
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
			2
			.
			s
			e
			t
			A
			b
			c
			(
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
			)
			;
			const a = await externalData2.getA()
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
			2
			.
			s
			e
			t
			A
			b
			c
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
			)
			;
			const a = await externalData2.getA()
			expect(a).to.eq("0x00");
		});
	})

	describe('setA', () => {
		it('Reverts when a overflows', async () => {
			await expect(
			externalData2.setA("0x01ffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData2.setA("0xffff")
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
			2
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
			externalData2.setA("0x00")
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
			2
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
			2
			.
			s
			e
			t
			A
			b
			c
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
			)
			;
			const b = await externalData2.getB()
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
			2
			.
			s
			e
			t
			A
			b
			c
			(
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
			)
			;
			const b = await externalData2.getB()
			expect(b).to.eq("-0x8000");
		});
	})

	describe('setB', () => {
		it('Reverts when b overflows', async () => {
			await expect(
			externalData2.setB("0x7fffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData2.setB("-0x800000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData2.setB("0x7fff")
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
			2
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
			externalData2.setB("-0x8000")
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
			2
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
			2
			.
			s
			e
			t
			A
			b
			c
			(
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
			)
			;
			const c = await externalData2.getC()
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
			2
			.
			s
			e
			t
			A
			b
			c
			(
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
			)
			;
			const c = await externalData2.getC()
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('getD', () => {
		it('Should be able to get min value', async () => {
			await externalData2.setD(true);
			const d = await externalData2.getD()
			expect(d).to.eq(true);
		});

		it('Should be able to get max value', async () => {
			await externalData2.setD(false);
			const d = await externalData2.getD()
			expect(d).to.eq(false);
		});
	})

	describe('setD', () => {
		it('Should be able to set min value', async () => {
			externalData2.setD(true)
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
			2
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
			externalData2.setD(false)
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
			2
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
})