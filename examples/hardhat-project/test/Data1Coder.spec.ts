import { ethers } from 'hardhat';
import { expect } from "chai";

describe('Data1Coder.sol', () => {
	let externalData1: any;

	before(async () => {
		const Factory = await ethers.getContractFactory('ExternalData1Coder');
		externalData1 = await Factory.deploy();
	})

	describe('encode', () => {
		it('Reverts when a overflows', async () => {
			await expect(
			externalData1.encode("0x01ffff", "-0x8000", "-0x80000000", false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b overflows', async () => {
			await expect(
			externalData1.encode("0x00", "0x7fffff", "-0x80000000", false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData1.encode("0x00", "-0x800000", "-0x80000000", false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c overflows', async () => {
			await expect(
			externalData1.encode("0x00", "-0x8000", "0x7fffffffff", false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData1.encode("0x00", "-0x8000", "-0x8000000000", false)
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData1.encode("0xffff", "-0x8000", "0x7fffffff", false)
			const a = await externalData1.getA();
			const b = await externalData1.getB();
			const c = await externalData1.getC();
			const d = await externalData1.getD();
			expect(a).to.eq("0xffff");
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
			expect(d).to.eq(false);
		});

		it('Should be able to set max/min values', async () => {
			externalData1.encode("0x00", "0x7fff", "-0x80000000", true)
			const a = await externalData1.getA();
			const b = await externalData1.getB();
			const c = await externalData1.getC();
			const d = await externalData1.getD();
			expect(a).to.eq("0x00");
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
			expect(d).to.eq(true);
		});
	})

	describe('setAbc', () => {
		it('Reverts when a overflows', async () => {
			await expect(
			externalData1.setAbc("0x01ffff", "-0x8000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b overflows', async () => {
			await expect(
			externalData1.setAbc("0x00", "0x7fffff", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData1.setAbc("0x00", "-0x800000", "-0x80000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c overflows', async () => {
			await expect(
			externalData1.setAbc("0x00", "-0x8000", "0x7fffffffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData1.setAbc("0x00", "-0x8000", "-0x8000000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData1.setAbc("0xffff", "-0x8000", "0x7fffffff")
			const a = await externalData1.getA();
			const b = await externalData1.getB();
			const c = await externalData1.getC();
			expect(a).to.eq("0xffff");
			expect(b).to.eq("-0x8000");
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to set max/min values', async () => {
			externalData1.setAbc("0x00", "0x7fff", "-0x80000000")
			const a = await externalData1.getA();
			const b = await externalData1.getB();
			const c = await externalData1.getC();
			expect(a).to.eq("0x00");
			expect(b).to.eq("0x7fff");
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('setCba', () => {
		it('Reverts when c overflows', async () => {
			await expect(
			externalData1.setCba("0x7fffffffff", "-0x8000", "0x00")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData1.setCba("-0x8000000000", "-0x8000", "0x00")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b overflows', async () => {
			await expect(
			externalData1.setCba("-0x80000000", "0x7fffff", "0x00")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData1.setCba("-0x80000000", "-0x800000", "0x00")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when a overflows', async () => {
			await expect(
			externalData1.setCba("-0x80000000", "-0x8000", "0x01ffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min/max values', async () => {
			externalData1.setCba("0x7fffffff", "-0x8000", "0xffff")
			const c = await externalData1.getC();
			const b = await externalData1.getB();
			const a = await externalData1.getA();
			expect(c).to.eq("0x7fffffff");
			expect(b).to.eq("-0x8000");
			expect(a).to.eq("0xffff");
		});

		it('Should be able to set max/min values', async () => {
			externalData1.setCba("-0x80000000", "0x7fff", "0x00")
			const c = await externalData1.getC();
			const b = await externalData1.getB();
			const a = await externalData1.getA();
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
			1
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
			)
			;
			const a = await externalData1.getA()
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
			1
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
			)
			;
			const a = await externalData1.getA()
			expect(a).to.eq("0x00");
		});
	})

	describe('setA', () => {
		it('Reverts when a overflows', async () => {
			await expect(
			externalData1.setA("0x01ffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData1.setA("0xffff")
			const a = await externalData1.getA();
			expect(a).to.eq("0xffff");
		});

		it('Should be able to set max value', async () => {
			externalData1.setA("0x00")
			const a = await externalData1.getA();
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
			1
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
			)
			;
			const b = await externalData1.getB()
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
			1
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
			)
			;
			const b = await externalData1.getB()
			expect(b).to.eq("-0x8000");
		});
	})

	describe('setB', () => {
		it('Reverts when b overflows', async () => {
			await expect(
			externalData1.setB("0x7fffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when b underflows', async () => {
			await expect(
			externalData1.setB("-0x800000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData1.setB("0x7fff")
			const b = await externalData1.getB();
			expect(b).to.eq("0x7fff");
		});

		it('Should be able to set max value', async () => {
			externalData1.setB("-0x8000")
			const b = await externalData1.getB();
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
			1
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
			)
			;
			const c = await externalData1.getC()
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
			1
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
			)
			;
			const c = await externalData1.getC()
			expect(c).to.eq("-0x80000000");
		});
	})

	describe('setC', () => {
		it('Reverts when c overflows', async () => {
			await expect(
			externalData1.setC("0x7fffffffff")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Reverts when c underflows', async () => {
			await expect(
			externalData1.setC("-0x8000000000")
			).to.be.revertedWith("0x11 (Arithmetic operation underflowed or overflowed outside of an unchecked block)");
		});

		it('Should be able to set min value', async () => {
			externalData1.setC("0x7fffffff")
			const c = await externalData1.getC();
			expect(c).to.eq("0x7fffffff");
		});

		it('Should be able to set max value', async () => {
			externalData1.setC("-0x80000000")
			const c = await externalData1.getC();
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
			1
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
			)
			;
			const d = await externalData1.getD()
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
			1
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
			)
			;
			const d = await externalData1.getD()
			expect(d).to.eq(false);
		});
	})

	describe('setD', () => {
		it('Should be able to set min value', async () => {
			externalData1.setD(true)
			const d = await externalData1.getD();
			expect(d).to.eq(true);
		});

		it('Should be able to set max value', async () => {
			externalData1.setD(false)
			const d = await externalData1.getD();
			expect(d).to.eq(false);
		});
	})
})